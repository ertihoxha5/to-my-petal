"""Turns raw model output into an honest, validated AnalysisResult.

Pure functions only (no torch), so every branch is unit-tested.

Order of checks:
  1. Plant species not covered by the classifier  -> unsupported_species (model not run)
  2. No validated model loaded                    -> model_unavailable
  3. Image looks unlike the training data (energy above the validation-derived
     threshold)                                   -> unsupported_image
  4. Photo too dark / bright / blurry             -> inconclusive
  5. Most probability mass on another crop        -> inconclusive
  6. Best match for the stated crop below the validation-derived
     confidence threshold                         -> inconclusive (closest matches listed)
  7. Otherwise                                    -> possible_issue / no_known_issue
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np
from PIL import Image

from .labels import LABELS, SUPPORTED_SPECIES
from .schemas import AnalysisResult, Hypothesis, ImageQuality, ModelInfo

# Heuristic photo-quality limits, chosen by inspecting sample photos. They catch
# obviously unusable images only and are documented as heuristics.
DARK_LIMIT = 0.12
BRIGHT_LIMIT = 0.92
BLUR_LIMIT = 40.0
ALTERNATIVE_MIN = 0.10

BASE_LIMITATIONS = [
    "The model learned from lab-style photos of single leaves (PlantVillage). Photos taken in a "
    "garden or at home are harder for it, and it is less reliable on them.",
    "It only knows a few conditions of tomato, potato and bell pepper leaves. Anything else, such as "
    "nutrient problems, pests other than spider mites, sunscald or watering stress, cannot be detected.",
    "A photo alone cannot confirm a cause. For a serious or spreading problem, contact a local "
    "extension service or plant clinic.",
]


@dataclass(frozen=True)
class ModelThresholds:
    temperature: float
    confidence_min: float
    energy_max: float
    crop_mass_min: float


def assess_quality(img: Image.Image) -> ImageQuality:
    gray = img.convert("L")
    gray.thumbnail((512, 512))
    arr = np.asarray(gray, dtype=np.float32)
    brightness = float(arr.mean() / 255.0)
    lap = (arr[:-2, 1:-1] + arr[2:, 1:-1] + arr[1:-1, :-2] + arr[1:-1, 2:]) - 4 * arr[1:-1, 1:-1]
    sharpness = float(lap.var())
    issues: list = []
    if brightness < DARK_LIMIT:
        issues.append("too_dark")
    elif brightness > BRIGHT_LIMIT:
        issues.append("too_bright")
    if sharpness < BLUR_LIMIT:
        issues.append("blurry")
    return ImageQuality(
        brightness=round(brightness, 4), sharpness=round(sharpness, 2), issues=issues
    )


def softmax(x: Sequence[float], temperature: float = 1.0) -> list[float]:
    m = max(v / temperature for v in x)
    exps = [math.exp(v / temperature - m) for v in x]
    s = sum(exps)
    return [e / s for e in exps]


def energy(logits: Sequence[float]) -> float:
    m = max(logits)
    return -(m + math.log(sum(math.exp(v - m) for v in logits)))


def _hypothesis(label: str, score: float, confidence_min: float) -> Hypothesis:
    info = LABELS[label]
    strength = "closer" if score >= confidence_min else ("partial" if score >= 0.35 else "weak")
    return Hypothesis(
        label=label,
        crop=info.crop,
        condition=info.condition,
        healthy=info.healthy,
        guide_slug=info.guide_slug,
        summary=info.summary,
        strength=strength,
        calibrated_score=round(min(max(score, 0.0), 1.0), 4),
    )


def unsupported_species(species_key: str, plant_name: str, model: ModelInfo) -> AnalysisResult:
    supported = ", ".join(v.lower() for v in SUPPORTED_SPECIES.values())
    return AnalysisResult(
        outcome="unsupported_species",
        headline="This plant is not supported yet",
        explanation=(
            f"The image model currently knows only {supported} leaves, so it did not look at this photo "
            f"of {plant_name}. The photo and your notes can still go in the journal, where you can "
            "compare it with later photos."
        ),
        reasons=["species_not_supported"],
        limitations=[],
        model=model,
    )


def model_unavailable(model: ModelInfo) -> AnalysisResult:
    return AnalysisResult(
        outcome="model_unavailable",
        headline="Image analysis is unavailable right now",
        explanation=(
            "Your photo was saved, but no validated model is loaded on this server, so we can't "
            "suggest anything about it. You can still save it to the journal and try the analysis again later."
        ),
        reasons=["model_not_loaded"],
        model=model,
    )


def decide(
    *,
    logits: Sequence[float],
    classes: Sequence[str],
    thresholds: ModelThresholds,
    species_key: str,
    quality: ImageQuality,
    model: ModelInfo,
) -> AnalysisResult:
    if species_key not in SUPPORTED_SPECIES:
        raise ValueError("decide() called for an unsupported species")
    if len(logits) != len(classes):
        raise ValueError("logits and classes differ in length")
    probs = softmax(logits, thresholds.temperature)
    e = energy(logits)
    crop_name = SUPPORTED_SPECIES[species_key].lower()
    limitations = list(BASE_LIMITATIONS)

    if e > thresholds.energy_max:
        return AnalysisResult(
            outcome="unsupported_image",
            headline="This image is inconclusive",
            explanation=(
                "This photo looks quite different from the leaf photos the model learned from, so we "
                "won't guess. Try one leaf filling most of the frame, in soft daylight, against a plain "
                "background."
            ),
            reasons=["unfamiliar_image"],
            limitations=limitations,
            quality=quality,
            model=model,
        )

    in_crop = [(c, p) for c, p in zip(classes, probs, strict=True) if LABELS[c].crop == species_key]
    in_crop.sort(key=lambda cp: cp[1], reverse=True)
    crop_mass = sum(p for _, p in in_crop)
    closest = [
        _hypothesis(c, p, thresholds.confidence_min) for c, p in in_crop[:3] if p >= ALTERNATIVE_MIN
    ]

    if quality.issues:
        words = {
            "too_dark": "quite dark",
            "too_bright": "very bright or washed out",
            "blurry": "blurry",
        }
        described = " and ".join(words[i] for i in quality.issues)
        return AnalysisResult(
            outcome="inconclusive",
            headline="This image is inconclusive",
            explanation=(
                f"The photo looks {described}, which makes leaf details hard to read. Please try again "
                "with a sharp photo in soft, even light."
            ),
            reasons=[f"quality_{i}" for i in quality.issues],
            limitations=limitations,
            quality=quality,
            model=model,
        )

    if crop_mass < thresholds.crop_mass_min:
        top_other = max(zip(classes, probs, strict=True), key=lambda cp: cp[1])[0]
        other_crop = SUPPORTED_SPECIES[LABELS[top_other].crop].lower()
        return AnalysisResult(
            outcome="inconclusive",
            headline="This image is inconclusive",
            explanation=(
                f"You told us this is a {crop_name} plant, but the model's closest matches were "
                f"{other_crop} leaves. That usually means the photo is hard to read, so we won't suggest "
                "a condition. A closer photo of a single leaf may help."
            ),
            reasons=["crop_mismatch"],
            limitations=limitations,
            quality=quality,
            model=model,
        )

    best_label, best_p = in_crop[0]
    if best_p < thresholds.confidence_min:
        names = " or ".join(h.condition.lower() for h in closest[:2]) or "any single condition"
        return AnalysisResult(
            outcome="inconclusive",
            headline="This image is inconclusive",
            explanation=(
                f"The model's closest matches were {names}, but none was strong enough for us to suggest "
                "it. Compare the photo with the care guide, or try another photo of the most affected leaf."
            ),
            alternatives=closest[:3],
            reasons=["low_confidence"],
            limitations=limitations,
            quality=quality,
            model=model,
        )

    primary = _hypothesis(best_label, best_p, thresholds.confidence_min)
    alternatives = [h for h in closest if h.label != best_label][:2]
    info = LABELS[best_label]
    if info.healthy:
        return AnalysisResult(
            outcome="no_known_issue",
            headline="No known issue found",
            explanation=(
                f"The model suggests this looks like a healthy {crop_name} leaf. It only checks for the "
                "few conditions it learned, so keep watching anything that worries you and add a "
                "follow-up photo in a week or two."
            ),
            primary=primary,
            alternatives=alternatives,
            limitations=limitations,
            quality=quality,
            model=model,
        )
    return AnalysisResult(
        outcome="possible_issue",
        headline=f"Possible {info.condition.lower()}",
        explanation=(
            f"The model suggests this leaf resembles {info.condition.lower()}: {info.summary}. Other "
            "things can cause similar marks, so treat this as a starting point, compare with the care "
            "guide, and watch how it develops."
        ),
        primary=primary,
        alternatives=alternatives,
        limitations=limitations,
        quality=quality,
        model=model,
    )
