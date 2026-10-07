# Model card: `pv15-mobilenetv3large-20261006-36d40ae8`

A leaf-photo classifier used by to my petal to suggest *possible* issues on tomato, potato and bell
pepper leaves. It is a starting point for a gardener's own observation, not a diagnosis.

Full evaluation output: [`docs/model-evaluation/`](model-evaluation/) (metrics, per-class tables,
confusion matrices, training history, data-preparation report).

## Intended use

- **For**: home gardeners photographing a single tomato, potato or bell-pepper leaf, as one input next to
  their own notes, the care guide and follow-up photos.
- **Not for**: diagnosing plants, choosing chemical treatments, commercial crop decisions, other species,
  or whole-plant and fruit photos.

## Model

| | |
|---|---|
| Architecture | torchvision MobileNetV3-Large, ImageNet `IMAGENET1K_V2` weights, new 15-way linear head |
| Input | RGB, resize shorter side to 256 (bilinear), centre crop 224, ImageNet mean/std |
| Training | 1 epoch head-only (AdamW 1e-3), then 5 epochs full fine-tuning (AdamW, one-cycle LR max 4e-4, weight decay 1e-4), batch 64, label smoothing 0.05, class weights ∝ 1/√frequency; best epoch by validation macro F1 (epoch 5 of 6: 0.988) |
| Augmentation (training only) | random resized crop (scale 0.45–1), horizontal and vertical flips, rotation ±25°, colour jitter, Gaussian blur, random erasing |
| Hardware | CPU only (20-core laptop), about 2.5 hours |
| Software | torch 2.14.1+cpu, torchvision 0.29.1+cpu, Python 3.12; seed 20261006 |
| Size | 17 MB weights; 60–130 ms per photo on CPU through the API |

## Data

- **PlantVillage** `raw/color` (Mohanty, Hughes & Salathé 2016; CC BY-SA 3.0 per the
  [Hugging Face dataset card](https://huggingface.co/datasets/mohanty/PlantVillage)), 15 classes,
  22,773 images after de-duplication.
- **Split by leaf, not by photo**: 70/15/15 by group. 16,036 images (70%) are grouped by the authors'
  leaf map (several photos of one physical leaf stay together); the other 6,737, including every *Tomato
  mosaic virus* image, fall back to per-photo groups. The leakage check (no group or file hash in two
  splits) passed. Train 15,905 / validation 3,434 / test 3,434.
- **Near-OOD set**: 660 leaves from 11 other PlantVillage crops, never trained on.
- **Real-world set**: PlantDoc (Singh et al. 2020; CC BY 4.0), train+test classification crops for the
  12 overlapping classes, 1,096 internet-collected photos. Used only for evaluation.

## Uncertainty and abstention (fitted on validation only)

| Mechanism | Value | Effect in the app |
|---|---|---|
| Temperature scaling | T = 0.534 (validation ECE 0.079 → 0.004) | calibrated scores, shown only in a details panel with a caveat |
| Confidence threshold | 0.846: smallest score where validation accuracy on accepted photos ≥ 99.5% (98.3% coverage) | below it: "This image is inconclusive", closest matches listed but not endorsed |
| Unfamiliar-input check | energy > −4.282 (97.5th percentile of validation energies) | "This image is inconclusive", no prediction shown |
| Crop agreement | ≥ 60% of probability on the plant the user selected | otherwise inconclusive ("closest matches were potato leaves…") |
| Photo quality | brightness < 0.12 or > 0.92; Laplacian variance < 40 | inconclusive with a retake tip (simple heuristics) |
| Species gate | plant must be tomato, potato or bell pepper | otherwise "This plant is not supported yet", model not run |

The selective-accuracy target was first 97%. Because validation accuracy (98.9%) already exceeded it, that
threshold never abstained, so the target was raised to 99.5% *before* looking at test or real-world
results, and refitted on validation (`tomypetal_ml.recalibrate`; the earlier values are kept in
`metadata.json → calibration_history`).

## Results

### Controlled: PlantVillage held-out test split (lab-style photos)

| Metric | Value |
|---|---|
| Accuracy | 0.995 |
| Macro F1 | 0.995 (per-class F1 0.980–1.000) |
| Calibrated ECE | 0.005 |
| Photos where the app would show a finding | 97.3% |
| Accuracy of those findings | 99.97% |
| Flagged as unfamiliar | 2.1% |

### Near out-of-distribution: leaves of 11 crops it never saw

| Metric | Value |
|---|---|
| Flagged as unfamiliar | 80.2% |
| Would still show a (necessarily wrong) finding | **17.9%** |
| Energy AUROC vs. the test split | 0.97 |

### Real world: PlantDoc (independently collected)

| Metric | Value |
|---|---|
| Accuracy (all photos, no abstention) | **0.31** |
| Macro F1 | **0.27** (per-class F1 0.02–0.46) |
| Calibrated ECE | 0.42 (lab calibration does not transfer) |
| Flagged as unfamiliar | 77.7% |
| Photos where the app would show a finding | 18.7% |
| Accuracy of those findings | **0.42** |

Per-class tables are in [`docs/model-evaluation/EVALUATION.md`](model-evaluation/EVALUATION.md).
Notably weak in the real world: tomato bacterial spot (recall 0.01), mosaic virus (0.04), leaf mold (0.09)
and healthy tomato (0.13). The model over-predicts early and late blight on real photos.

## What this means

- The model works very well on photos that look like PlantVillage and **poorly on real garden photos**.
  This is a known property of PlantVillage-trained models (uniform backgrounds and lighting) and is the main
  reason the app words every result as "possible", lists alternatives and limitations, and abstains often.
- In practice most garden photos are declined as inconclusive. Spot checks with real Septoria photos from
  Wikimedia Commons, a basil leaf, a fruit photo and the app icon were all declined. When a finding *is*
  shown for a real photo, the evaluation suggests it is right only about 4 times in 10, and the result
  page says so.
- Passing the unfamiliar-input check does not prove a photo shows a supported plant: 17.9% of other crops'
  leaves got through. Non-plant photos were not systematically evaluated.
- The model classifies whole images. It cannot locate lesions, so the app shows no overlays or heatmaps.
- PlantDoc labels come from its authors' annotation of web images and contain some noise; numbers are
  indicative, and 1,096 photos give wide confidence intervals for small classes.

## Improving it

Train with real-world photos (for example PlantDoc's training split while holding out its test split, or
photos contributed with consent), add a dedicated "leaf / not a leaf" detector, and re-evaluate on an
independently collected test set before relaxing any wording in the app.

## License of the weights

Trained on CC BY-SA 3.0 data. If you distribute the weights, distribute them under CC BY-SA 3.0 with
attribution to the PlantVillage authors.
