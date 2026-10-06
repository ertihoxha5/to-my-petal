"""Registry of classifier labels the app knows how to explain.

A model is only loaded if every class in its metadata appears here, so a model
trained on different labels can never be shown with the wrong names.
"""

from __future__ import annotations

from dataclasses import dataclass

# species_key values the classifier can be asked about.
SUPPORTED_SPECIES = {
    "tomato": "Tomato",
    "potato": "Potato",
    "pepper_bell": "Bell pepper",
}

# Known plants that can be journaled but are not covered by the classifier.
KNOWN_UNSUPPORTED_SPECIES = {
    "basil": "Basil",
    "monstera": "Monstera",
    "other": "Other plant",
}

ALL_SPECIES = {**SUPPORTED_SPECIES, **KNOWN_UNSUPPORTED_SPECIES}


@dataclass(frozen=True)
class LabelInfo:
    crop: str
    condition: str  # short name, e.g. "Early blight"
    healthy: bool
    guide_slug: str
    summary: str  # what the visual pattern usually looks like, in plain words


LABELS: dict[str, LabelInfo] = {
    "Pepper,_bell___Bacterial_spot": LabelInfo(
        "pepper_bell", "Bacterial spot", False, "bacterial-spot",
        "small water-soaked spots that turn brown, sometimes with yellowing around them",
    ),
    "Pepper,_bell___healthy": LabelInfo(
        "pepper_bell", "No known issue", True, "bell-pepper-care",
        "leaves resembling the healthy pepper leaves the model learned from",
    ),
    "Potato___Early_blight": LabelInfo(
        "potato", "Early blight", False, "early-blight",
        "brown spots with concentric rings, often starting on older, lower leaves",
    ),
    "Potato___Late_blight": LabelInfo(
        "potato", "Late blight", False, "late-blight",
        "large dark, greasy-looking patches that can spread quickly in cool, wet weather",
    ),
    "Potato___healthy": LabelInfo(
        "potato", "No known issue", True, "potato-care",
        "leaves resembling the healthy potato leaves the model learned from",
    ),
    "Tomato___Bacterial_spot": LabelInfo(
        "tomato", "Bacterial spot", False, "bacterial-spot",
        "many small dark spots, sometimes with a yellow halo",
    ),
    "Tomato___Early_blight": LabelInfo(
        "tomato", "Early blight", False, "early-blight",
        "brown spots with target-like rings, usually on older, lower leaves first",
    ),
    "Tomato___Late_blight": LabelInfo(
        "tomato", "Late blight", False, "late-blight",
        "large dark, water-soaked patches, sometimes with pale growth underneath",
    ),
    "Tomato___Leaf_Mold": LabelInfo(
        "tomato", "Leaf mold", False, "tomato-leaf-mold",
        "pale yellow patches on top of the leaf with olive-green to grey fuzz underneath",
    ),
    "Tomato___Septoria_leaf_spot": LabelInfo(
        "tomato", "Septoria leaf spot", False, "septoria-leaf-spot",
        "many small round spots with darker edges and lighter centres",
    ),
    "Tomato___Spider_mites Two-spotted_spider_mite": LabelInfo(
        "tomato", "Spider mite damage", False, "spider-mites",
        "fine pale speckling (stippling), sometimes with very fine webbing",
    ),
    "Tomato___Target_Spot": LabelInfo(
        "tomato", "Target spot", False, "target-spot",
        "brown spots with light centres and faint rings",
    ),
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": LabelInfo(
        "tomato", "Yellow leaf curl (virus)", False, "tomato-yellow-leaf-curl",
        "upward-curling, yellow-edged, small leaves",
    ),
    "Tomato___Tomato_mosaic_virus": LabelInfo(
        "tomato", "Mosaic virus", False, "tomato-mosaic",
        "mottled light and dark green patches, sometimes with distorted leaves",
    ),
    "Tomato___healthy": LabelInfo(
        "tomato", "No known issue", True, "tomato-care",
        "leaves resembling the healthy tomato leaves the model learned from",
    ),
}


def normalise_species(text: str) -> str:
    """Best-effort mapping of free-text species to a species_key."""
    t = text.strip().lower()
    if not t or "sweet potato" in t or "ipomoea" in t:
        return "other"
    checks = [
        # Only bell (sweet) peppers are in the training data, not chilli peppers.
        ("pepper_bell", ("bell pepper", "sweet pepper", "capsicum annuum")),
        ("tomato", ("tomato", "solanum lycopersicum", "domate")),
        ("potato", ("potato", "solanum tuberosum", "patate")),
        ("basil", ("basil", "ocimum", "borzilok")),
        ("monstera", ("monstera",)),
    ]
    for key, words in checks:
        if any(w in t for w in words):
            return key
    return "other"
