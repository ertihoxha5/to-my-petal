"""Transfer-learning training for the to my petal leaf classifier.

Usage:
    uv run python -m tomypetal_ml.train --data data/prepared --out artifacts/run-001

Outputs in --out:
    model.pt        state_dict of the fine-tuned network
    metadata.json   classes, preprocessing, calibration and abstention thresholds
                    (this is what the backend validates before loading)
    config.json     every training argument, library versions and the seed
    history.json    per-epoch loss / validation metrics
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import random
import time
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import sklearn
import torch
import torchvision
from sklearn.metrics import f1_score
from torch import nn
from torch.utils.data import DataLoader

from .calibration import expected_calibration_error, fit_temperature, selective_threshold
from .classes import TARGET_CLASSES, crop_of
from .modeling import (
    CROP,
    IMAGENET_MEAN,
    IMAGENET_STD,
    RESIZE,
    SUPPORTED_ARCHITECTURES,
    ManifestDataset,
    build_model,
    collect_logits,
    energy_score,
    eval_transform,
    head_parameters,
    read_manifest,
    train_transform,
)

METADATA_SCHEMA_VERSION = 1


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.use_deterministic_algorithms(False)  # some CPU kernels have no deterministic variant


def run_epoch(model, loader, criterion, optimizer, scheduler=None) -> float:
    model.train()
    total, n = 0.0, 0
    for x, y in loader:
        optimizer.zero_grad(set_to_none=True)
        loss = criterion(model(x), y)
        loss.backward()
        optimizer.step()
        if scheduler is not None:
            scheduler.step()
        total += loss.item() * len(y)
        n += len(y)
    return total / max(n, 1)


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--data", required=True, type=Path, help="output dir of prepare_dataset")
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--architecture", default="mobilenet_v3_large", choices=SUPPORTED_ARCHITECTURES)
    ap.add_argument("--seed", type=int, default=20261006)
    ap.add_argument("--head-epochs", type=int, default=1)
    ap.add_argument("--epochs", type=int, default=6, help="full fine-tuning epochs")
    ap.add_argument("--batch-size", type=int, default=64)
    ap.add_argument("--lr-head", type=float, default=1e-3)
    ap.add_argument("--lr", type=float, default=4e-4)
    ap.add_argument("--weight-decay", type=float, default=1e-4)
    ap.add_argument("--label-smoothing", type=float, default=0.05)
    # DataLoader worker processes have crashed (segfault) during full fine-tuning on
    # Windows with torch 2.14 CPU wheels, so the default there is in-process loading.
    ap.add_argument("--workers", type=int, default=0 if platform.system() == "Windows" else 6)
    ap.add_argument("--threads", type=int, default=0, help="torch CPU threads (0 = default)")
    ap.add_argument("--target-selective-accuracy", type=float, default=0.97)
    ap.add_argument("--energy-percentile", type=float, default=97.5)
    ap.add_argument(
        "--limit-per-class", type=int, default=0, help="debug: cap training images per class"
    )
    args = ap.parse_args()

    seed_everything(args.seed)
    if args.threads:
        torch.set_num_threads(args.threads)
    data_root = args.data.resolve()
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    manifest = data_root / "manifest.csv"

    train_rows = read_manifest(manifest, "train")
    val_rows = read_manifest(manifest, "val")
    if args.limit_per_class:
        capped: dict[str, int] = {}
        kept = []
        for r in train_rows:
            if capped.get(r["label"], 0) < args.limit_per_class:
                kept.append(r)
                capped[r["label"]] = capped.get(r["label"], 0) + 1
        train_rows = kept
    labels_present = {r["label"] for r in train_rows}
    unknown = labels_present - set(TARGET_CLASSES)
    if unknown or labels_present != set(TARGET_CLASSES):
        raise SystemExit(
            f"Label validation failed. unknown={unknown} missing={set(TARGET_CLASSES) - labels_present}"
        )

    gen = torch.Generator().manual_seed(args.seed)
    train_ds = ManifestDataset(data_root, train_rows, TARGET_CLASSES, train_transform())
    val_ds = ManifestDataset(data_root, val_rows, TARGET_CLASSES, eval_transform())
    loader_kw = {"num_workers": args.workers, "persistent_workers": args.workers > 0}
    train_dl = DataLoader(
        train_ds,
        batch_size=args.batch_size,
        shuffle=True,
        generator=gen,
        drop_last=True,
        **loader_kw,
    )
    val_dl = DataLoader(val_ds, batch_size=128, shuffle=False, **loader_kw)

    counts = np.bincount(
        [TARGET_CLASSES.index(r["label"]) for r in train_rows], minlength=len(TARGET_CLASSES)
    )
    class_weights = torch.tensor((counts.mean() / counts) ** 0.5, dtype=torch.float32)
    criterion = nn.CrossEntropyLoss(weight=class_weights, label_smoothing=args.label_smoothing)

    model = build_model(args.architecture, len(TARGET_CLASSES), pretrained=True)
    history = []
    started = time.time()

    def validate(epoch: int, phase: str, train_loss: float) -> float:
        logits, labels = collect_logits(model, val_dl)
        preds = logits.argmax(1).numpy()
        macro_f1 = float(f1_score(labels.numpy(), preds, average="macro"))
        acc = float((preds == labels.numpy()).mean())
        entry = {
            "epoch": epoch,
            "phase": phase,
            "train_loss": round(train_loss, 4),
            "val_accuracy": round(acc, 4),
            "val_macro_f1": round(macro_f1, 4),
            "elapsed_s": round(time.time() - started),
        }
        history.append(entry)
        print(json.dumps(entry), flush=True)
        return macro_f1

    # Phase 1: train only the new classifier head.
    for p in model.parameters():
        p.requires_grad = False
    for p in head_parameters(model):
        p.requires_grad = True
    opt = torch.optim.AdamW(head_parameters(model), lr=args.lr_head, weight_decay=args.weight_decay)
    for e in range(args.head_epochs):
        loss = run_epoch(model, train_dl, criterion, opt)
        validate(e + 1, "head", loss)

    # Phase 2: fine-tune the whole network with a cosine schedule.
    for p in model.parameters():
        p.requires_grad = True
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    sched = torch.optim.lr_scheduler.OneCycleLR(
        opt, max_lr=args.lr, total_steps=max(1, args.epochs * len(train_dl)), pct_start=0.15
    )
    best_f1, best_state = -1.0, None
    for e in range(args.epochs):
        loss = run_epoch(model, train_dl, criterion, opt, sched)
        f1 = validate(args.head_epochs + e + 1, "finetune", loss)
        if f1 > best_f1:
            best_f1 = f1
            best_state = {k: v.detach().clone() for k, v in model.state_dict().items()}
    assert best_state is not None
    model.load_state_dict(best_state)

    # Calibration and abstention thresholds, all fitted on validation data only.
    val_logits, val_labels = collect_logits(model, val_dl)
    temperature = fit_temperature(val_logits, val_labels)
    probs_raw = torch.softmax(val_logits, 1).numpy()
    probs_cal = torch.softmax(val_logits / temperature, 1).numpy()
    y = val_labels.numpy()
    conf_threshold, coverage, sel_acc = selective_threshold(
        probs_cal, y, args.target_selective_accuracy
    )
    energies = energy_score(val_logits).numpy()
    energy_max = float(np.percentile(energies, args.energy_percentile))

    weights_path = out / "model.pt"
    torch.save(best_state, weights_path)
    sha = hashlib.sha256(weights_path.read_bytes()).hexdigest()
    now = datetime.now(UTC)
    version = f"pv15-{args.architecture.replace('_', '')}-{now:%Y%m%d}-{sha[:8]}"

    metadata = {
        "schema_version": METADATA_SCHEMA_VERSION,
        "model_version": version,
        "created_at": now.isoformat(),
        "architecture": args.architecture,
        "num_classes": len(TARGET_CLASSES),
        "classes": TARGET_CLASSES,
        "class_crops": {c: crop_of(c) for c in TARGET_CLASSES},
        "preprocessing": {
            "color_mode": "RGB",
            "resize_shorter_side": RESIZE,
            "center_crop": CROP,
            "interpolation": "bilinear",
            "mean": IMAGENET_MEAN,
            "std": IMAGENET_STD,
        },
        "calibration": {
            "method": "temperature_scaling",
            "fitted_on": "validation split",
            "temperature": round(temperature, 5),
            "val_ece_before": round(expected_calibration_error(probs_raw, y), 4),
            "val_ece_after": round(expected_calibration_error(probs_cal, y), 4),
        },
        "thresholds": {
            "confidence_min": round(conf_threshold, 5),
            "target_selective_accuracy": args.target_selective_accuracy,
            "val_coverage_at_threshold": round(coverage, 4),
            "val_accuracy_at_threshold": round(sel_acc, 4),
            "energy_max": round(energy_max, 5),
            "energy_percentile_of_val": args.energy_percentile,
            "crop_mass_min": 0.6,
        },
        "dataset": {
            "name": "PlantVillage raw/color subset (15 classes: tomato, potato, bell pepper)",
            "license": "CC BY-SA 3.0",
            "splits": "leaf-grouped train/val/test, see prepare_report.json",
            "train_images": len(train_rows),
            "val_images": len(val_rows),
        },
        "weights_file": "model.pt",
        "weights_sha256": sha,
    }
    (out / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    config = {
        **{k: (str(v) if isinstance(v, Path) else v) for k, v in vars(args).items()},
        "versions": {
            "torch": torch.__version__,
            "torchvision": torchvision.__version__,
            "numpy": np.__version__,
            "scikit-learn": sklearn.__version__,
            "python": platform.python_version(),
        },
        "best_val_macro_f1": round(best_f1, 4),
        "duration_s": round(time.time() - started),
    }
    (out / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
    (out / "history.json").write_text(json.dumps(history, indent=2), encoding="utf-8")
    report = data_root / "prepare_report.json"
    if report.exists():
        (out / "prepare_report.json").write_text(
            report.read_text(encoding="utf-8"), encoding="utf-8"
        )
    print(
        json.dumps(
            {
                "model_version": version,
                "temperature": temperature,
                "confidence_min": conf_threshold,
                "coverage": coverage,
                "energy_max": energy_max,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
