"""Evaluate a trained model on held-out data.

Usage:
    # Controlled (PlantVillage) test split + near-out-of-distribution leaves
    uv run python -m tomypetal_ml.evaluate --model-dir artifacts/run-001 --data data/prepared

    # Additionally, independently collected real-world photos arranged as
    # <dir>/<folder>/<image>, with a JSON file mapping folder names to class names
    # (or to "__unsupported__" for folders whose label is outside the model's classes)
    uv run python -m tomypetal_ml.evaluate --model-dir artifacts/run-001 --data data/prepared \
        --real-world-dir data/plantdoc/test --real-world-mapping mappings/plantdoc.json

Writes metrics.json, confusion_matrix_<set>.csv and EVALUATION.md into --model-dir.
Controlled and real-world results are always reported separately.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from sklearn.metrics import confusion_matrix, precision_recall_fscore_support, roc_auc_score
from torch.utils.data import DataLoader, Dataset

from .calibration import expected_calibration_error
from .modeling import ManifestDataset, build_model, collect_logits, energy_score, eval_transform, read_manifest

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}


class FolderDataset(Dataset):
    def __init__(self, items: list[tuple[Path, int]], transform):
        self.items = items
        self.transform = transform

    def __len__(self) -> int:
        return len(self.items)

    def __getitem__(self, i: int):
        path, label = self.items[i]
        with Image.open(path) as im:
            img = im.convert("RGB")
        return self.transform(img), label


def load_model(model_dir: Path):
    meta = json.loads((model_dir / "metadata.json").read_text(encoding="utf-8"))
    weights = model_dir / meta["weights_file"]
    sha = hashlib.sha256(weights.read_bytes()).hexdigest()
    if sha != meta["weights_sha256"]:
        raise SystemExit("weights_sha256 mismatch: metadata does not describe these weights")
    model = build_model(meta["architecture"], meta["num_classes"], pretrained=False)
    model.load_state_dict(torch.load(weights, map_location="cpu", weights_only=True), strict=True)
    model.eval()
    return model, meta


def decide(probs: np.ndarray, energies: np.ndarray, meta: dict) -> np.ndarray:
    """Mirror of the backend's acceptance rule (without the species and image-quality
    checks, which need user context): True where a finding would be shown."""
    th = meta["thresholds"]
    return (energies <= th["energy_max"]) & (probs.max(1) >= th["confidence_min"])


def classification_block(logits: torch.Tensor, labels: np.ndarray, meta: dict, name: str, out: Path) -> dict:
    classes = meta["classes"]
    t = meta["calibration"]["temperature"]
    probs = torch.softmax(logits / t, 1).numpy()
    energies = energy_score(logits).numpy()
    preds = probs.argmax(1)
    p, r, f, s = precision_recall_fscore_support(
        labels, preds, labels=list(range(len(classes))), zero_division=0
    )
    present = s > 0
    cm = confusion_matrix(labels, preds, labels=list(range(len(classes))))
    with (out / f"confusion_matrix_{name}.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["true \\ predicted", *classes])
        for c, row in zip(classes, cm, strict=True):
            w.writerow([c, *row.tolist()])
    accepted = decide(probs, energies, meta)
    correct = preds == labels
    return {
        "images": int(len(labels)),
        "accuracy": round(float(correct.mean()), 4),
        "macro_f1": round(float(f[present].mean()), 4),
        "macro_f1_note": "averaged over classes present in this set",
        "ece_calibrated": round(expected_calibration_error(probs, labels), 4),
        "per_class": {
            c: {"precision": round(float(p[i]), 4), "recall": round(float(r[i]), 4),
                "f1": round(float(f[i]), 4), "support": int(s[i])}
            for i, c in enumerate(classes)
        },
        "abstention": {
            "accepted_fraction": round(float(accepted.mean()), 4),
            "accuracy_on_accepted": round(float(correct[accepted].mean()), 4) if accepted.any() else None,
            "flagged_unfamiliar_fraction": round(float((energies > meta["thresholds"]["energy_max"]).mean()), 4),
        },
        "confusion_matrix_file": f"confusion_matrix_{name}.csv",
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model-dir", required=True, type=Path)
    ap.add_argument("--data", required=True, type=Path)
    ap.add_argument("--real-world-dir", type=Path)
    ap.add_argument("--real-world-mapping", type=Path)
    ap.add_argument("--real-world-name", default="real_world")
    ap.add_argument("--real-world-source", default="")
    args = ap.parse_args()

    model_dir = args.model_dir.resolve()
    data_root = args.data.resolve()
    model, meta = load_model(model_dir)
    classes = meta["classes"]
    tf = eval_transform()
    results: dict = {"model_version": meta["model_version"], "thresholds": meta["thresholds"]}

    # 1. Controlled test split (same lab conditions as training).
    test_rows = read_manifest(data_root / "manifest.csv", "test")
    dl = DataLoader(ManifestDataset(data_root, test_rows, classes, tf), batch_size=128)
    logits, labels = collect_logits(model, dl)
    results["controlled_test"] = {
        "description": "PlantVillage leaf-grouped test split. Lab-style photos of single leaves on plain "
        "backgrounds; NOT representative of photos taken in a garden or home.",
        **classification_block(logits, labels.numpy(), meta, "controlled_test", model_dir),
    }
    in_energy = energy_score(logits).numpy()

    # 2. Near-OOD: leaves of crops the model was never trained on.
    ood_manifest = data_root / "near_ood_manifest.csv"
    if ood_manifest.exists():
        ood_rows = read_manifest(ood_manifest)
        dl = DataLoader(ManifestDataset(data_root, ood_rows, classes, tf), batch_size=128)
        ood_logits, _ = collect_logits(model, dl)
        ood_energy = energy_score(ood_logits).numpy()
        ood_probs = torch.softmax(ood_logits / meta["calibration"]["temperature"], 1).numpy()
        accepted = decide(ood_probs, ood_energy, meta)
        y = np.r_[np.zeros_like(in_energy), np.ones_like(ood_energy)]
        results["near_ood"] = {
            "description": "Leaves of 11 other PlantVillage crops (apple, grape, corn, ...). The model should "
            "not present findings for these.",
            "images": int(len(ood_energy)),
            "flagged_unfamiliar_fraction": round(float((ood_energy > meta["thresholds"]["energy_max"]).mean()), 4),
            "would_show_finding_fraction": round(float(accepted.mean()), 4),
            "energy_auroc_vs_controlled_test": round(float(roc_auc_score(y, np.r_[in_energy, ood_energy])), 4),
            "note": "Measured on lab-style leaves only. Non-plant photos and real-world backgrounds are "
            "not covered by this number.",
        }

    # 3. Independently collected real-world photos.
    if args.real_world_dir and args.real_world_mapping:
        mapping: dict[str, str] = json.loads(args.real_world_mapping.read_text(encoding="utf-8"))
        bad = {v for v in mapping.values() if v not in classes and v != "__unsupported__"}
        if bad:
            raise SystemExit(f"Mapping refers to unknown classes: {bad}")
        items: list[tuple[Path, int]] = []
        unsupported: list[tuple[Path, int]] = []
        for folder in sorted(p for p in args.real_world_dir.iterdir() if p.is_dir()):
            target = mapping.get(folder.name)
            if target is None:
                continue
            for img in sorted(folder.iterdir()):
                if img.suffix.lower() not in IMAGE_EXT:
                    continue
                if target == "__unsupported__":
                    unsupported.append((img, -1))
                else:
                    items.append((img, classes.index(target)))
        valid = []
        for path, label in items:
            try:
                with Image.open(path) as im:
                    im.verify()
                valid.append((path, label))
            except Exception:  # noqa: BLE001
                continue
        dl = DataLoader(FolderDataset(valid, tf), batch_size=64)
        rw_logits, rw_labels = collect_logits(model, dl)
        block = classification_block(rw_logits, rw_labels.numpy(), meta, args.real_world_name, model_dir)
        results[args.real_world_name] = {
            "description": "Independently collected photos (different source, backgrounds and lighting).",
            "source": args.real_world_source,
            "skipped_unreadable": len(items) - len(valid),
            **block,
        }

    (model_dir / "metrics.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    write_markdown(model_dir, results, classes)
    print(json.dumps({k: {kk: vv for kk, vv in v.items() if kk in (
        "images", "accuracy", "macro_f1", "abstention", "flagged_unfamiliar_fraction",
        "would_show_finding_fraction", "energy_auroc_vs_controlled_test")} for k, v in results.items()
        if isinstance(v, dict) and "images" in v}, indent=2))


def write_markdown(model_dir: Path, results: dict, classes: list[str]) -> None:
    lines = [f"# Evaluation: {results['model_version']}", ""]
    for key, block in results.items():
        if not isinstance(block, dict) or "images" not in block:
            continue
        lines += [f"## {key}", "", block.get("description", ""), "", f"- Images: {block['images']}"]
        for k in ("accuracy", "macro_f1", "ece_calibrated", "flagged_unfamiliar_fraction",
                  "would_show_finding_fraction", "energy_auroc_vs_controlled_test"):
            if k in block:
                lines.append(f"- {k}: {block[k]}")
        if "abstention" in block:
            lines.append(f"- abstention: {block['abstention']}")
        if "per_class" in block:
            lines += ["", "| class | precision | recall | F1 | support |", "|---|---|---|---|---|"]
            for c in classes:
                m = block["per_class"][c]
                if m["support"]:
                    lines.append(f"| {c} | {m['precision']} | {m['recall']} | {m['f1']} | {m['support']} |")
        lines.append("")
    (model_dir / "EVALUATION.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
