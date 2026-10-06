"""Class subset used by the to my petal classifier.

These names are copied exactly from the PlantVillage "raw/color" folder names
(mohanty/PlantVillage on Hugging Face, mirrored from spMohanty/PlantVillage-Dataset).
`prepare_dataset.py` fails loudly if any of them is missing from the archive.
"""

TARGET_CLASSES: list[str] = [
    "Pepper,_bell___Bacterial_spot",
    "Pepper,_bell___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus",
    "Tomato___healthy",
]

# Leaves of other PlantVillage crops. They are never used for training; a sample is
# kept as a "near out-of-distribution" set to measure how often the unsupported-input
# check rejects leaves the model has never seen. Passing this check does NOT prove an
# image is a supported plant.
NEAR_OOD_CROPS: list[str] = [
    "Apple",
    "Blueberry",
    "Cherry_(including_sour)",
    "Corn_(maize)",
    "Grape",
    "Orange",
    "Peach",
    "Raspberry",
    "Soybean",
    "Squash",
    "Strawberry",
]


def crop_of(class_name: str) -> str:
    """'Pepper,_bell___healthy' -> 'pepper_bell'; 'Tomato___Leaf_Mold' -> 'tomato'."""
    crop = class_name.split("___", 1)[0]
    return {"Pepper,_bell": "pepper_bell", "Potato": "potato", "Tomato": "tomato"}.get(
        crop, crop.lower()
    )
