"""Refit calibration and abstention thresholds on the validation split, without retraining.

Usage:
    uv run python -m tomypetal_ml.recalibrate --model-dir artifacts/run-001 --data data/prepared \
        --target-selective-accuracy 0.995

Only validation data is used, so test and real-world results stay independent. The previous
values are kept under "calibration_history" in metadata.json.
"""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader

from .calibration import expected_calibration_error, fit_temperature, selective_threshold
from .evaluate import load_model
from .modeling import ManifestDataset, collect_logits, energy_score, eval_transform, read_manifest


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--model-dir", required=True, type=Path)
    ap.add_argument("--data", required=True, type=Path)
    ap.add_argument("--target-selective-accuracy", type=float, default=0.995)
    ap.add_argument("--energy-percentile", type=float, default=97.5)
    ap.add_argument("--manifest", default="manifest.csv")
    ap.add_argument(
        "--threshold-source",
        choices=("all", "plantdoc"),
        default="all",
        help="fit the confidence threshold on all validation rows, or only on real-world ones",
    )
    args = ap.parse_args()

    model_dir = args.model_dir.resolve()
    model, meta = load_model(model_dir)
    rows = read_manifest(args.data.resolve() / args.manifest, "val")
    dl = DataLoader(
        ManifestDataset(args.data.resolve(), rows, meta["classes"], eval_transform()),
        batch_size=128,
    )
    logits, labels = collect_logits(model, dl)
    y = labels.numpy()

    t = fit_temperature(logits, labels)
    raw = torch.softmax(logits, 1).numpy()
    cal = torch.softmax(logits / t, 1).numpy()
    sources = np.array([r.get("source") or "plantvillage" for r in rows])
    sel = sources == "plantdoc" if args.threshold_source == "plantdoc" else np.ones(len(rows), bool)
    if not sel.any():
        raise SystemExit("No validation rows for the requested --threshold-source")
    conf, coverage, acc = selective_threshold(cal[sel], y[sel], args.target_selective_accuracy)
    per_source = {}
    for src in sorted(set(sources)):
        m = sources == src
        accepted = cal[m].max(1) >= conf
        per_source[src] = {
            "val_images": int(m.sum()),
            "coverage": round(float(accepted.mean()), 4),
            "accuracy_on_accepted": round(float((cal[m].argmax(1) == y[m])[accepted].mean()), 4)
            if accepted.any()
            else None,
        }
    energy_max = float(np.percentile(energy_score(logits).numpy(), args.energy_percentile))

    history = meta.get("calibration_history", [])
    history.append(
        {
            "replaced_at": datetime.now(UTC).isoformat(),
            "calibration": meta["calibration"],
            "thresholds": meta["thresholds"],
        }
    )
    meta["calibration_history"] = history
    meta["calibration"] = {
        "method": "temperature_scaling",
        "fitted_on": "validation split",
        "temperature": round(t, 5),
        "val_ece_before": round(expected_calibration_error(raw, y), 4),
        "val_ece_after": round(expected_calibration_error(cal, y), 4),
    }
    meta["thresholds"] = {
        "confidence_min": round(conf, 5),
        "target_selective_accuracy": args.target_selective_accuracy,
        "val_coverage_at_threshold": round(coverage, 4),
        "val_accuracy_at_threshold": round(acc, 4),
        "energy_max": round(energy_max, 5),
        "energy_percentile_of_val": args.energy_percentile,
        "crop_mass_min": meta["thresholds"].get("crop_mass_min", 0.6),
        "fitted_on_source": args.threshold_source,
        "val_by_source": per_source,
    }
    (model_dir / "metadata.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(
        json.dumps({"calibration": meta["calibration"], "thresholds": meta["thresholds"]}, indent=2)
    )


if __name__ == "__main__":
    main()
