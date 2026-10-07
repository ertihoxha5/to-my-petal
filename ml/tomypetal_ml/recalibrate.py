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
    args = ap.parse_args()

    model_dir = args.model_dir.resolve()
    model, meta = load_model(model_dir)
    rows = read_manifest(args.data.resolve() / "manifest.csv", "val")
    dl = DataLoader(
        ManifestDataset(args.data.resolve(), rows, meta["classes"], eval_transform()),
        batch_size=128,
    )
    logits, labels = collect_logits(model, dl)
    y = labels.numpy()

    t = fit_temperature(logits, labels)
    raw = torch.softmax(logits, 1).numpy()
    cal = torch.softmax(logits / t, 1).numpy()
    conf, coverage, acc = selective_threshold(cal, y, args.target_selective_accuracy)
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
    }
    (model_dir / "metadata.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(
        json.dumps({"calibration": meta["calibration"], "thresholds": meta["thresholds"]}, indent=2)
    )


if __name__ == "__main__":
    main()
