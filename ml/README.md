# to my petal: leaf classifier workflow

Everything needed to rebuild the image model from public data: dataset preparation with
leaf-level grouping, transfer learning, calibration, abstention thresholds and evaluation on
both lab-style and independently collected real-world photos.

The app does **not** depend on this folder at runtime. It only needs the output folder
(`metadata.json`, `model.pt`, optional `metrics.json`). Without one, analyses honestly report
"unavailable".

## 1. Data sources (verified 2026-10-06)

| Dataset | Use | Source | License |
|---|---|---|---|
| PlantVillage, `raw/color` | training, validation, controlled test | [`mohanty/PlantVillage`](https://huggingface.co/datasets/mohanty/PlantVillage) on Hugging Face (dataset card by S. P. Mohanty), mirroring [spMohanty/PlantVillage-Dataset](https://github.com/spMohanty/PlantVillage-Dataset) | CC BY-SA 3.0 (as declared on the dataset card) |
| PlantVillage leaf map | grouping photos of the same physical leaf | `leaf_grouping/leaf-map.json` in the same repository | same |
| PlantDoc (classification crops) | real-world evaluation only | [pratikkayal/PlantDoc-Dataset](https://github.com/pratikkayal/PlantDoc-Dataset) | CC BY 4.0 |

Citations:
- Mohanty, Hughes & Salathé (2016). *Using deep learning for image-based plant disease detection.* Frontiers in Plant Science 7:1419. doi:10.3389/fpls.2016.01419
- Singh et al. (2020). *PlantDoc: A Dataset for Visual Plant Disease Detection.* CoDS-COMAD 2020. doi:10.1145/3371158.3371196

Notes:
- The GitHub repository of PlantVillage shows no license file; the CC BY-SA 3.0 statement comes from the
  Hugging Face dataset card. CC BY-SA asks that adapted material is shared under the same license, so if
  you distribute trained weights, distribute them under CC BY-SA 3.0 with attribution.
- PlantDoc images were collected from the internet by its authors. We use them only to measure the model
  and never redistribute them.
- Datasets are never committed. `ml/data/` and `ml/artifacts/*` are git-ignored.

### Classes

The model covers 15 PlantVillage classes, copied verbatim from the archive folder names
([`tomypetal_ml/classes.py`](tomypetal_ml/classes.py)); preparation fails if any is missing:

- Bell pepper: bacterial spot, healthy
- Potato: early blight, late blight, healthy
- Tomato: bacterial spot, early blight, late blight, leaf mold, septoria leaf spot, two-spotted spider
  mite, target spot, yellow leaf curl virus, mosaic virus, healthy

Basil and Monstera are journal-only plants. They are not in PlantVillage and the app never analyses them.

## 2. Setup

```bash
cd ml
uv sync                 # Python 3.12, CPU PyTorch from the official PyTorch index (locked in uv.lock)
```

## 3. Download the data (about 2.2 GB + 0.9 GB)

Keep downloads outside OneDrive or other synced folders.

```bash
mkdir -p data/raw && cd data/raw
curl -L -C - -o data.zip      https://huggingface.co/datasets/mohanty/PlantVillage/resolve/main/data.zip
curl -L      -o leaf-map.json https://huggingface.co/datasets/mohanty/PlantVillage/resolve/main/leaf_grouping/leaf-map.json
curl -L      -o plantdoc.tar.gz https://codeload.github.com/pratikkayal/PlantDoc-Dataset/tar.gz/refs/heads/master
cd ../..
```

Expected size of `data.zip`: 2,184,723,441 bytes.

## 4. Prepare

```bash
uv run python -m tomypetal_ml.prepare_dataset --zip data/raw/data.zip --leaf-map data/raw/leaf-map.json --out data/prepared
uv run python -m tomypetal_ml.prepare_plantdoc --tar data/raw/plantdoc.tar.gz --out data/plantdoc
```

`prepare_dataset`:
- reads only `raw/color/<class>/<file>` entries and rebuilds every output path itself (no archive paths are trusted);
- verifies each image decodes and hashes it;
- **groups related photos**: the authors' leaf map links each photo to a physical leaf
  (`class:::leaf number`); byte-identical files are merged into one group as well;
- splits whole groups per class into train / validation / test (70 / 15 / 15, seed `20261006`);
- fails if any group or file hash appears in more than one split;
- samples 60 leaves from each of 11 other PlantVillage crops as a *near out-of-distribution* set (never trained on);
- writes `manifest.csv`, `near_ood_manifest.csv` and `prepare_report.json`.

On the current archive: 22,773 images in 10,469 groups. 16,036 images (70%) are grouped by the
leaf map; the remaining 6,737 (including all *Tomato mosaic virus* images, which the leaf map does not
cover) fall back to one group per photo identifier, so some leakage between near-duplicate photos of the
same leaf may remain for those.

## 5. Train

```bash
uv run python -m tomypetal_ml.train --data data/prepared --out artifacts/run-001
```

- MobileNetV3-Large pretrained on ImageNet (torchvision `IMAGENET1K_V2`); new 15-way head.
- 1 epoch training only the head, then full fine-tuning with AdamW + one-cycle LR (default 5 epochs).
- **Training-only augmentation**: random resized crops, flips, rotation, colour jitter, blur, random erasing.
  Validation and test use resize 256 → centre crop 224 only.
- Mild class weighting (inverse square root of frequency) and label smoothing 0.05.
- Best epoch chosen by validation macro F1.
- Seeds fixed; every argument, library version and the best score go to `config.json`.

On CPU this takes hours (≈25–35 min per epoch on a 20-core laptop; keep the laptop plugged in, as battery
saving throttles it heavily). A checkpoint is written after every fine-tuning epoch; rerun the same command
with `--resume` to continue an interrupted run. DataLoader worker processes crashed
during full fine-tuning on Windows with the torch 2.14 CPU wheels, so loading runs in-process there by
default (`--workers 0`); Linux uses 6 workers.

### Uncertainty handling (all fitted on the validation split)

1. **Temperature scaling**: one temperature minimises validation NLL.
2. **Confidence threshold**: the smallest calibrated top-score at which validation predictions above it reach
   97% accuracy (selective classification). Below it the app says *inconclusive* and lists the closest matches
   without endorsing them.
3. **Unfamiliar-input threshold**: the 97.5th percentile of validation *energy scores*
   (−logsumexp of logits). Higher energy → *this image is inconclusive*, no prediction shown.
4. In the app, also: the user's stated plant must receive most of the probability mass (crop agreement),
   and simple brightness/blur heuristics flag unusable photos.

The app adds a model-independent leaf-likeness check (share of plant-coloured pixels ≥ 10%), see
`backend/app/inference/decision.py`.

None of these proves an image shows a supported plant. The energy check is measured on held-out leaves of
other crops (near-OOD); non-plant images and cluttered real-world backgrounds are not covered by that number.

## 5b. Fine-tune with real-world photos (recommended)

Lab-only training performs poorly on garden photos. To adapt the model, split PlantDoc into its own
train / validation / held-out test sets and fine-tune on PlantVillage + PlantDoc-train:

```bash
uv run python -m tomypetal_ml.mix_realworld --prepared data/prepared --plantdoc data/plantdoc \
    --mapping mappings/plantdoc.json
uv run python -m tomypetal_ml.train --data data/prepared --manifest manifest_mixed.csv \
    --out artifacts/run-002 --init-from artifacts/run-001/model.pt --head-epochs 0 --epochs 5 \
    --lr 2e-4 --realworld-weight 12 --samples-per-epoch 6400 --seed 20261007
uv run python -m tomypetal_ml.recalibrate --model-dir artifacts/run-002 --data data/prepared \
    --manifest manifest_mixed.csv --threshold-source plantdoc --target-selective-accuracy 0.80
uv run python -m tomypetal_ml.evaluate --model-dir artifacts/run-002 --data data/prepared \
    --manifest manifest_mixed.csv
```

`mix_realworld` groups near-duplicate PlantDoc photos (64-bit difference hash, ≤ 6 bits apart) so they
never straddle splits, drops near-duplicates of PlantVillage images, and drops duplicate groups whose
copies carry different labels. It writes `manifest_mixed.csv` (PlantDoc rows split 55 / 15 / 30 into
`train`, `val`, `rw_test`) and `mix_report.json`. PlantDoc has no target spot, spider mite or healthy
potato photos, so those classes remain lab-only.

Model selection uses the mean of lab and real-world validation macro F1. The confidence threshold is fitted
on the real-world validation photos only (target: 80% accuracy on accepted photos, chosen before looking at
test results). The energy threshold uses all validation photos. The `rw_test` rows are used only by
`evaluate`. To compare models fairly, evaluate the previous model on the same manifest:

```bash
uv run python -m tomypetal_ml.evaluate --model-dir artifacts/run-001 --data data/prepared \
    --manifest manifest_mixed.csv --out-dir artifacts/eval-run-001-mixed
```

## 6. Evaluate

```bash
uv run python -m tomypetal_ml.evaluate --model-dir artifacts/run-001 --data data/prepared \
    --real-world-dir data/plantdoc --real-world-mapping mappings/plantdoc.json \
    --real-world-source "PlantDoc (train+test, CC BY 4.0)"
```

Writes `metrics.json`, `EVALUATION.md` and `confusion_matrix_<set>.csv` into the model folder:
per-class precision, recall and F1, macro F1, accuracy, calibrated ECE, abstention coverage, near-OOD
rejection and energy AUROC. Lab-style and real-world results are kept in separate sections.

[`mappings/plantdoc.json`](mappings/plantdoc.json) maps 12 PlantDoc folders to PlantVillage classes;
PlantDoc has no target spot, spider mite or healthy potato folders.

## 7. Install the model in the app

```bash
# from the repository root
mkdir -p backend/models/current
cp ml/artifacts/run-002/{model.pt,metadata.json,metrics.json} backend/models/current/   # or run-001 for the lab-only model
```

Restart the API. `GET /api/system/model` reports `available: true` and the version.

## 8. Tests

```bash
uv sync --group dev
uv run pytest
```
