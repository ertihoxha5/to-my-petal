"""Extract, validate and split the PlantVillage subset used by to my petal.

Usage:
    uv run python -m tomypetal_ml.prepare_dataset \
        --zip /path/to/data.zip --leaf-map /path/to/leaf-map.json --out data/prepared

What it does:
  1. Reads only `raw/color/<class>/<file>` members of the archive (never trusts member
     paths: every output path is rebuilt from a validated class name and a hash).
  2. Verifies each image decodes, records size and SHA-256.
  3. Groups images of the same physical leaf using the dataset authors' leaf map, and
     merges byte-identical files, so related photos never straddle train/val/test.
  4. Splits groups per class into train/val/test with a fixed seed.
  5. Samples leaves of other crops as a near-out-of-distribution evaluation set.
  6. Writes manifest.csv and prepare_report.json.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import random
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image

from .classes import NEAR_OOD_CROPS, TARGET_CLASSES

COLOR_PREFIX = "raw/color/"
SAFE_EXT = {".jpg", ".jpeg", ".png"}


def leaf_map_key(file_name: str) -> str:
    """Reproduce the identifier used as key in leaf-map.json.

    File names look like '<uuid>___RS_Erly.B 7554.JPG'; the key is the part after
    the last '___', without extension or ' copy' suffixes, lower-cased.
    """
    ident = file_name.replace("_final_masked", "")
    if "___" in ident:
        ident = ident.split("___")[-1]
    ident = ident.split("copy")[0]
    ident = re.sub(r"\.(jpe?g|png)$", "", ident, flags=re.IGNORECASE)
    return ident.strip().lower()


def resolve_leaf_group(class_name: str, file_name: str, leaf_map: dict[str, list[str]]) -> str | None:
    suggestions = leaf_map.get(leaf_map_key(file_name))
    if not suggestions:
        return None
    for suggestion in suggestions:
        cls, _, leaf = suggestion.partition(":::")
        if cls == class_name:
            return f"{cls}:::{leaf}"
    return None


class UnionFind:
    def __init__(self) -> None:
        self.parent: dict[str, str] = {}

    def find(self, x: str) -> str:
        self.parent.setdefault(x, x)
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: str, b: str) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[max(ra, rb)] = min(ra, rb)


def split_groups(
    groups_by_class: dict[str, dict[str, int]], fractions: tuple[float, float, float], seed: int
) -> dict[str, str]:
    """Assign each group to train/val/test, balancing image counts per class."""
    rng = random.Random(seed)
    assignment: dict[str, str] = {}
    names = ("train", "val", "test")
    for cls in sorted(groups_by_class):
        groups = sorted(groups_by_class[cls].items())
        rng.shuffle(groups)
        total = sum(n for _, n in groups)
        targets = [f * total for f in fractions]
        filled = [0, 0, 0]
        # Greedy: give each group to the split with the largest relative shortfall.
        # Ties go to val/test first so small classes still get evaluation data.
        for gid, n in groups:
            idx = max((1, 2, 0), key=lambda i: (targets[i] - filled[i]) / max(targets[i], 1e-9))
            assignment[gid] = names[idx]
            filled[idx] += n
    return assignment


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--zip", required=True, type=Path, help="PlantVillage data.zip")
    ap.add_argument("--leaf-map", required=True, type=Path, help="leaf_grouping/leaf-map.json")
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--seed", type=int, default=20261006)
    ap.add_argument("--fractions", type=float, nargs=3, default=(0.7, 0.15, 0.15))
    ap.add_argument("--ood-per-crop", type=int, default=60)
    args = ap.parse_args()

    out: Path = args.out.resolve()
    img_root = out / "images"
    img_root.mkdir(parents=True, exist_ok=True)
    leaf_map: dict[str, list[str]] = json.loads(args.leaf_map.read_text(encoding="utf-8"))

    target_set = set(TARGET_CLASSES)
    class_index = {c: i for i, c in enumerate(TARGET_CLASSES)}
    rows: list[dict[str, str]] = []
    ood_candidates: dict[str, list[zipfile.ZipInfo]] = defaultdict(list)
    seen_classes: Counter[str] = Counter()
    rejected: Counter[str] = Counter()
    uf = UnionFind()
    hash_owner: dict[str, str] = {}

    with zipfile.ZipFile(args.zip) as zf:
        members = [m for m in zf.infolist() if not m.is_dir() and m.filename.startswith(COLOR_PREFIX)]
        for m in members:
            parts = m.filename[len(COLOR_PREFIX):].split("/")
            if len(parts) != 2:
                rejected["unexpected_path"] += 1
                continue
            cls, fname = parts
            if Path(fname).suffix.lower() not in SAFE_EXT:
                rejected["unexpected_extension"] += 1
                continue
            crop = cls.split("___", 1)[0]
            if cls not in target_set:
                if crop in NEAR_OOD_CROPS:
                    ood_candidates[crop].append(m)
                continue
            data = zf.read(m)
            try:
                with Image.open(io.BytesIO(data)) as im:
                    im.verify()
                with Image.open(io.BytesIO(data)) as im:
                    im.load()
                    width, height = im.size
            except Exception:  # noqa: BLE001 - any decode failure rejects the file
                rejected["undecodable"] += 1
                continue
            sha = hashlib.sha256(data).hexdigest()
            dest_dir = img_root / f"c{class_index[cls]:02d}"
            dest_dir.mkdir(exist_ok=True)
            dest = dest_dir / f"{sha[:24]}.jpg"
            if not dest.exists():
                dest.write_bytes(data)
            leaf = resolve_leaf_group(cls, fname, leaf_map)
            image_id = f"img:{sha}"
            group_seed = f"leaf:{leaf}" if leaf else f"file:{cls}:::{leaf_map_key(fname)}"
            uf.union(image_id, group_seed)
            if sha in hash_owner:
                uf.union(image_id, hash_owner[sha])
                rejected["exact_duplicate_merged"] += 1
            hash_owner.setdefault(sha, image_id)
            seen_classes[cls] += 1
            rows.append(
                {
                    "path": dest.relative_to(out).as_posix(),
                    "label": cls,
                    "sha256": sha,
                    "image_id": image_id,
                    "grouping": "leaf_map" if leaf else "filename_fallback",
                    "width": str(width),
                    "height": str(height),
                    "source_member": m.filename,
                }
            )

        missing = [c for c in TARGET_CLASSES if seen_classes[c] == 0]
        if missing:
            raise SystemExit(f"Classes missing from archive (check class mapping): {missing}")

        # Near-OOD sample: other crops, fixed seed, never used for training.
        rng = random.Random(args.seed)
        ood_rows = []
        for crop in sorted(ood_candidates):
            pool = sorted(ood_candidates[crop], key=lambda z: z.filename)
            for m in rng.sample(pool, min(args.ood_per_crop, len(pool))):
                data = zf.read(m)
                try:
                    with Image.open(io.BytesIO(data)) as im:
                        im.load()
                except Exception:  # noqa: BLE001
                    continue
                sha = hashlib.sha256(data).hexdigest()
                dest_dir = img_root / "near_ood"
                dest_dir.mkdir(exist_ok=True)
                dest = dest_dir / f"{sha[:24]}.jpg"
                dest.write_bytes(data)
                ood_rows.append(
                    {"path": dest.relative_to(out).as_posix(), "label": "__near_ood__", "crop": crop,
                     "source_member": m.filename}
                )

    # Deduplicate rows that are byte-identical within the same class.
    unique: dict[tuple[str, str], dict[str, str]] = {}
    for r in rows:
        unique.setdefault((r["label"], r["sha256"]), r)
    rows = list(unique.values())

    group_of = {r["image_id"]: uf.find(r["image_id"]) for r in rows}
    group_labels: dict[str, Counter[str]] = defaultdict(Counter)
    for r in rows:
        group_labels[group_of[r["image_id"]]][r["label"]] += 1
    mixed_groups = [g for g, c in group_labels.items() if len(c) > 1]
    groups_by_class: dict[str, dict[str, int]] = defaultdict(dict)
    for g, counts in group_labels.items():
        primary = counts.most_common(1)[0][0]
        groups_by_class[primary][g] = sum(counts.values())

    assignment = split_groups(groups_by_class, tuple(args.fractions), args.seed)
    for r in rows:
        r["group"] = group_of[r["image_id"]]
        r["split"] = assignment[r["group"]]

    fields = ["path", "label", "split", "group", "grouping", "sha256", "width", "height", "source_member"]
    with (out / "manifest.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in sorted(rows, key=lambda r: (r["label"], r["path"])):
            w.writerow(r)
    with (out / "near_ood_manifest.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["path", "label", "crop", "source_member"])
        w.writeheader()
        w.writerows(ood_rows)

    # Leakage check: no group and no file hash may appear in more than one split.
    split_of_group: dict[str, set[str]] = defaultdict(set)
    split_of_hash: dict[str, set[str]] = defaultdict(set)
    for r in rows:
        split_of_group[r["group"]].add(r["split"])
        split_of_hash[r["sha256"]].add(r["split"])
    leaks = sum(1 for s in split_of_group.values() if len(s) > 1) + sum(
        1 for s in split_of_hash.values() if len(s) > 1
    )
    if leaks:
        raise SystemExit(f"Leakage check failed: {leaks} groups/hashes span multiple splits")

    per_class = {
        c: {s: sum(1 for r in rows if r["label"] == c and r["split"] == s) for s in ("train", "val", "test")}
        for c in TARGET_CLASSES
    }
    report = {
        "source": {
            "dataset": "PlantVillage (raw/color)",
            "archive": str(args.zip.name),
            "archive_bytes": args.zip.stat().st_size,
            "mirror": "https://huggingface.co/datasets/mohanty/PlantVillage",
            "original": "https://github.com/spMohanty/PlantVillage-Dataset",
            "license": "CC BY-SA 3.0 (as declared by the dataset card)",
            "citation": "Mohanty, Hughes & Salathé (2016), Frontiers in Plant Science 7:1419, "
            "doi:10.3389/fpls.2016.01419",
        },
        "seed": args.seed,
        "fractions": list(args.fractions),
        "classes": TARGET_CLASSES,
        "images": len(rows),
        "groups": len(group_labels),
        "groups_spanning_labels": len(mixed_groups),
        "grouping_coverage": dict(Counter(r["grouping"] for r in rows)),
        "per_class": per_class,
        "rejected": dict(rejected),
        "near_ood_images": len(ood_rows),
        "leakage_check": "passed",
    }
    (out / "prepare_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("images", "groups", "grouping_coverage", "rejected")}, indent=2))
    for c, s in per_class.items():
        print(f"{c:50s} {s}")


if __name__ == "__main__":
    main()
