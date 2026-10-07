"""Add real-world PlantDoc photos to a prepared PlantVillage dataset.

Usage:
    uv run python -m tomypetal_ml.mix_realworld --prepared data/prepared --plantdoc data/plantdoc \
        --mapping mappings/plantdoc.json

Writes `manifest_mixed.csv` next to `manifest.csv`: all PlantVillage rows unchanged (source
"plantvillage"), plus PlantDoc rows (source "plantdoc") split into train / val / rw_test.

Leakage control:
  * PlantDoc contains near-duplicate images (the same web photo at different sizes or crops).
    Images whose 64-bit difference hashes are within `--max-distance` bits are grouped, and whole
    groups are assigned to one split.
  * PlantDoc images that are near-duplicates of any PlantVillage image are dropped entirely.
  * The PlantDoc `rw_test` split is never used for training, calibration or model selection.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

from .classes import TARGET_CLASSES
from .prepare_dataset import UnionFind, split_groups

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}
STORE_MAX_SIDE = 512


def dhash(img: Image.Image) -> int:
    """64-bit difference hash: robust to resizing and recompression."""
    g = img.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    a = np.asarray(g, dtype=np.int16)
    bits = (a[:, 1:] > a[:, :-1]).flatten()
    return int("".join("1" if b else "0" for b in bits), 2)


def popcount(x: np.ndarray) -> np.ndarray:
    x = x.astype(np.uint64)
    count = np.zeros(x.shape, dtype=np.uint64)
    for _ in range(64):
        count += x & np.uint64(1)
        x >>= np.uint64(1)
    return count


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--prepared", required=True, type=Path)
    ap.add_argument("--plantdoc", required=True, type=Path, help="output of prepare_plantdoc")
    ap.add_argument("--mapping", required=True, type=Path)
    ap.add_argument("--seed", type=int, default=20261007)
    ap.add_argument("--fractions", type=float, nargs=3, default=(0.55, 0.15, 0.30))
    ap.add_argument("--max-distance", type=int, default=6)
    args = ap.parse_args()

    root = args.prepared.resolve()
    mapping: dict[str, str] = json.loads(args.mapping.read_text(encoding="utf-8"))
    unknown = {v for v in mapping.values() if v not in TARGET_CLASSES}
    if unknown:
        raise SystemExit(f"Mapping refers to unknown classes: {unknown}")

    pv_rows = list(csv.DictReader((root / "manifest.csv").open(encoding="utf-8")))
    print(f"hashing {len(pv_rows)} PlantVillage images…", flush=True)
    pv_hashes = []
    for r in pv_rows:
        with Image.open(root / r["path"]) as im:
            pv_hashes.append(dhash(im))
    pv_arr = np.array(pv_hashes, dtype=np.uint64)

    out_dir = root / "images" / "pd"
    out_dir.mkdir(parents=True, exist_ok=True)
    items = []
    rejected: Counter[str] = Counter()
    for folder in sorted(p for p in args.plantdoc.iterdir() if p.is_dir()):
        label = mapping.get(folder.name)
        if label is None:
            continue
        for f in sorted(folder.iterdir()):
            if f.suffix.lower() not in IMAGE_EXT:
                continue
            try:
                with Image.open(f) as im:
                    im.load()
                    img = (ImageOps.exif_transpose(im) or im).convert("RGB")
            except Exception:  # noqa: BLE001 - counted in "unreadable"
                rejected["unreadable"] += 1
                continue
            if min(img.size) < 64:
                rejected["too_small"] += 1
                continue
            h = dhash(img)
            if int(popcount(pv_arr ^ np.uint64(h)).min()) <= args.max_distance:
                rejected["near_duplicate_of_plantvillage"] += 1
                continue
            img.thumbnail((STORE_MAX_SIDE, STORE_MAX_SIDE), Image.Resampling.LANCZOS)
            sha = hashlib.sha256(img.tobytes()).hexdigest()
            dest = out_dir / f"{sha[:24]}.jpg"
            img.save(dest, "JPEG", quality=90)
            items.append(
                {
                    "path": dest.relative_to(root).as_posix(),
                    "label": label,
                    "hash": h,
                    "sha256": sha,
                    "source_member": f"{folder.name}/{f.name}",
                }
            )

    # Group near-duplicates within PlantDoc.
    uf = UnionFind()
    hashes = np.array([it["hash"] for it in items], dtype=np.uint64)
    for i in range(len(items)):
        uf.find(str(i))
        close = np.nonzero(popcount(hashes[i + 1 :] ^ hashes[i]) <= args.max_distance)[0]
        for j in close:
            uf.union(str(i), str(i + 1 + int(j)))
    group_labels: dict[str, Counter[str]] = defaultdict(Counter)
    for i, it in enumerate(items):
        it["group"] = "pd:" + uf.find(str(i))
        group_labels[it["group"]][it["label"]] += 1
    mixed_label_groups = [g for g, c in group_labels.items() if len(c) > 1]
    # A near-duplicate carrying two different labels is a labelling conflict: drop the group.
    items = [it for it in items if it["group"] not in mixed_label_groups]
    rejected["conflicting_label_duplicates"] = sum(
        sum(c.values()) for g, c in group_labels.items() if g in mixed_label_groups
    )
    groups_by_class: dict[str, dict[str, int]] = defaultdict(dict)
    for it in items:
        groups_by_class[it["label"]][it["group"]] = (
            groups_by_class[it["label"]].get(it["group"], 0) + 1
        )
    assignment = split_groups(groups_by_class, tuple(args.fractions), args.seed)
    rename = {"train": "train", "val": "val", "test": "rw_test"}

    fields = ["path", "label", "split", "group", "source", "sha256", "source_member"]
    with (root / "manifest_mixed.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in pv_rows:
            w.writerow({**r, "source": "plantvillage"})
        for it in items:
            w.writerow({**it, "split": rename[assignment[it["group"]]], "source": "plantdoc"})

    per_class = {
        c: {
            s: sum(1 for it in items if it["label"] == c and rename[assignment[it["group"]]] == s)
            for s in ("train", "val", "rw_test")
        }
        for c in TARGET_CLASSES
    }
    report = {
        "source": "PlantDoc (pratikkayal/PlantDoc-Dataset, CC BY 4.0), train+test folders",
        "seed": args.seed,
        "fractions": list(args.fractions),
        "dhash_max_distance": args.max_distance,
        "plantdoc_images_kept": len(items),
        "plantdoc_groups": len({it["group"] for it in items}),
        "rejected": dict(rejected),
        "per_class": per_class,
        "classes_without_real_world_data": [
            c for c, v in per_class.items() if sum(v.values()) == 0
        ],
    }
    (root / "mix_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {k: report[k] for k in ("plantdoc_images_kept", "plantdoc_groups", "rejected")},
            indent=2,
        )
    )
    for c, v in per_class.items():
        print(f"{c:48s} {v}")


if __name__ == "__main__":
    main()
