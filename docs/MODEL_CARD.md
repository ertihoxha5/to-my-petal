# Model card: `pv15-mobilenetv3large-20261007-18cfae9b`

A leaf-photo classifier used by to my petal to suggest *possible* issues on tomato, potato and bell
pepper leaves. It is a starting point for a gardener's own observation, not a diagnosis.

This is the second model (run 002). It fine-tunes the first, lab-only model (run 001) with
real-world photos. Both are documented in [`docs/model-evaluation/`](model-evaluation/):
- `run-002-mixed/`: the current model
- `run-001-lab-only/`: the previous model, including `on-heldout-plantdoc-split/`, its scores on the same held-out real-world photos

## Intended use

- **For**: home gardeners photographing a single tomato, potato or bell-pepper leaf, as one input next to
  their own notes, the care guide and follow-up photos.
- **Not for**: diagnosing plants, choosing chemical treatments, commercial crop decisions, other species,
  or whole-plant and fruit photos.

## Model

| | |
|---|---|
| Architecture | torchvision MobileNetV3-Large, 15-way linear head; 17 MB weights |
| Input | RGB, resize shorter side to 256 (bilinear), centre crop 224, ImageNet mean/std |
| Run 001 (lab only) | from ImageNet `IMAGENET1K_V2`: 1 head-only epoch, then 5 full fine-tuning epochs on PlantVillage (AdamW, one-cycle LR max 4e-4, batch 64, label smoothing 0.05, class weights ∝ 1/√frequency) |
| Run 002 (current) | from run 001's weights: 5 epochs × 6,400 sampled images on PlantVillage-train + PlantDoc-train, real photos oversampled ×12 (≈30% of each batch), one-cycle LR max 2e-4; best epoch 4 by the mean of lab and real-world validation macro F1 (0.981 / 0.588) |
| Augmentation (training only) | random resized crop (scale 0.45–1), flips, rotation ±25°, colour jitter, Gaussian blur, random erasing |
| Hardware / software | CPU only; torch 2.14.1+cpu, torchvision 0.29.1+cpu, Python 3.12; seeds 20261006 / 20261007 |
| Speed | about 0.1–0.2 s per photo on CPU through the API |

## Data

- **PlantVillage** `raw/color` (Mohanty, Hughes & Salathé 2016; CC BY-SA 3.0 per the
  [Hugging Face dataset card](https://huggingface.co/datasets/mohanty/PlantVillage)): 15 classes,
  22,773 images, split 70/15/15 **by physical leaf** where the authors' leaf map allows (70% of images;
  the rest, including all *Tomato mosaic virus*, fall back to per-photo groups). Train 15,905 / val 3,434 / test 3,434.
- **PlantDoc** (Singh et al. 2020; CC BY 4.0): internet-collected photos for the 12 classes that overlap.
  Near-duplicates (64-bit difference hash, ≤ 6 bits) are grouped so copies never straddle splits.
  60 photos were dropped because near-identical copies carried *different* labels, and 1 because it
  duplicated a PlantVillage image. The 1,035 kept are split 55/15/30 by group: train 566 / val 159 /
  **held-out test 310**. PlantDoc has no target spot, spider mite or healthy potato photos, so those
  classes remain lab-only.
- **Near-OOD set**: 660 leaves from 11 other PlantVillage crops, never trained on.

The held-out PlantDoc test photos were never used for training, calibration, thresholds or model selection.

## Uncertainty and abstention

All values are fitted on validation data and were decided before looking at test results.

| Mechanism | Value | Effect in the app |
|---|---|---|
| Temperature scaling | T = 0.672 (validation ECE 0.071 → 0.010) | calibrated scores, shown only in a details panel with a caveat |
| Confidence threshold | 0.979: smallest score at which the **real-world validation** photos above it are ≥ 80% correct (coverage 24%, accuracy 82%) | below it: "This image is inconclusive", closest matches listed but not endorsed |
| Unfamiliar-input check | energy > −4.063 (97.5th percentile of all validation energies) | "This image is inconclusive", no prediction shown |
| Leaf-likeness check (model-independent) | < 10% plant-coloured pixels (hue orange-brown to green, saturated, not dark); set just below the 0.5th percentile of validation photos | "We couldn't find much leaf in this photo" |
| Crop agreement | ≥ 60% of probability on the plant the user selected | otherwise inconclusive |
| Photo quality | dark (< 0.12), washed out (> 0.92), blurry (Laplacian variance < 40) | inconclusive with a retake tip |
| Species gate | tomato, potato or bell pepper only | "This plant is not supported yet", model not run |

The leaf-likeness check was added because fine-tuning on varied real photos made the energy check less
strict: the app icon passed it with run 002. The check declines 0.2% of lab test photos and 1.0% of
held-out real photos, and catches flat graphics like the icon and logo. It cannot reject orange, brown or
skin-coloured objects.

## Results

### Real world: held-out PlantDoc photos (310, identical for both models)

| Metric | Run 001 (lab only) | **Run 002 (current)** |
|---|---|---|
| Accuracy (no abstention) | 0.31 | **0.55** |
| Macro F1 | 0.28 | **0.55** (per class 0.24–0.81) |
| Calibrated ECE | — | 0.23 |
| Declined as unfamiliar | 78% | 22% |
| Photos where the app would show a finding | 20% | 22% |
| **Accuracy of those findings** | 0.37 | **0.79** (53 of 67; Wilson 95% CI ≈ 0.68–0.87) |

Every class improved. Weakest: tomato bacterial spot (F1 0.24), potato early blight (0.46),
tomato early blight (0.44). Strongest: yellow leaf curl virus (0.81), healthy tomato (0.65), Septoria (0.64).
"Would show a finding" and its accuracy apply the confidence and energy thresholds only. The app's
crop-agreement, leaf-likeness and photo-quality checks decline additional photos.

### Controlled: PlantVillage held-out test split (3,434 lab-style photos)

| Metric | Run 001 | **Run 002** |
|---|---|---|
| Accuracy | 0.995 | 0.993 |
| Macro F1 | 0.995 | 0.993 |
| Photos where the app would show a finding | 97.3% | 86.3% |
| Accuracy of those findings | 0.9997 | 1.000 |

Lab coverage fell because the confidence threshold is now set for real photos.

### Near out-of-distribution: leaves of 11 crops it never saw (660)

| Metric | Run 001 | **Run 002** |
|---|---|---|
| Would still show a (necessarily wrong) finding | 17.9% | **8.2%** |
| Flagged as unfamiliar | 80.2% | 56.1% |
| Energy AUROC vs. lab test | 0.97 | 0.92 |

## What this means

- On real garden-style photos, the app now declines most photos (≈78%). When it does show a finding, the
  evaluation suggests it is right about 4 times in 5, not 4 times in 10 as before. The result page states
  this figure from `metrics.json`.
- 310 test photos is a small sample. Per-class figures rest on 16–43 photos each and are rough.
- PlantDoc labels come from annotation of web images and contain noise (60 conflicting duplicates were found).
- Spot checks: two real Septoria photos from Wikimedia Commons were still declined (one as unfamiliar, one
  inconclusive, with *bacterial spot* as the closest, wrong, match). A basil leaf declared as tomato was
  declined for crop mismatch; a fruit photo and the app icon were declined.
- The model classifies whole images and cannot locate lesions, so the app shows no overlays. It cannot prove
  a photo shows a supported plant. Non-plant photos were not evaluated systematically.

## Improving it further

More real-world training photos (especially bacterial spot and early blight), photos contributed with
consent from the app's own users, a dedicated leaf detector, and an independent test set from a different
source than PlantDoc.

## License of the weights

Trained on CC BY-SA 3.0 (PlantVillage) and CC BY 4.0 (PlantDoc) data. If you distribute the weights,
distribute them under CC BY-SA 3.0 with attribution to both datasets' authors.
