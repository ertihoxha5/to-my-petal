"""Extract the PlantDoc classification images for real-world evaluation.

Usage:
    uv run python -m tomypetal_ml.prepare_plantdoc --tar plantdoc.tar.gz --out data/plantdoc

PlantDoc (Singh et al., 2020, CC BY 4.0) contains internet-collected photos of leaves in
real settings. It is used here ONLY for evaluation, never for training, so the reported
"real-world" numbers are independent of the training data. Some file names in the upstream
repository contain characters that are invalid on Windows, so files are renamed to a hash
of their original name while keeping the class folder.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import tarfile
from pathlib import Path

SPLITS = ("train", "test")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tar", required=True, type=Path, help="codeload tar.gz of pratikkayal/PlantDoc-Dataset")
    ap.add_argument("--out", required=True, type=Path)
    args = ap.parse_args()

    counts: dict[str, int] = {}
    with tarfile.open(args.tar, "r:gz") as tf:
        for member in tf:
            if not member.isfile():
                continue
            parts = member.name.split("/")
            # <repo>-<branch>/<split>/<class folder>/<file>
            if len(parts) != 4 or parts[1] not in SPLITS:
                continue
            folder = parts[2]
            if not re.fullmatch(r"[A-Za-z_ ]+", folder):
                continue
            fh = tf.extractfile(member)
            if fh is None:
                continue
            data = fh.read()
            ext = ".png" if data[:8] == b"\x89PNG\r\n\x1a\n" else ".jpg"
            name = hashlib.sha1(f"{parts[1]}/{parts[3]}".encode()).hexdigest()[:16] + ext  # noqa: S324 - naming only
            dest = args.out / folder
            dest.mkdir(parents=True, exist_ok=True)
            (dest / name).write_bytes(data)
            counts[folder] = counts.get(folder, 0) + 1
    for folder in sorted(counts):
        print(f"{counts[folder]:5d}  {folder}")
    print(f"{sum(counts.values())} images")


if __name__ == "__main__":
    main()
