"""Model architecture, preprocessing and dataset helpers shared by train/evaluate.

The backend rebuilds the same architecture from `metadata.json`
(backend/app/inference/model_loader.py); keep the two in sync.
"""

from __future__ import annotations

import csv
from pathlib import Path

import torch
from PIL import Image
from torch import nn
from torch.utils.data import Dataset
from torchvision import models, transforms

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]
RESIZE = 256
CROP = 224

SUPPORTED_ARCHITECTURES = ("mobilenet_v3_large", "efficientnet_b0")


def build_model(architecture: str, num_classes: int, pretrained: bool) -> nn.Module:
    if architecture == "mobilenet_v3_large":
        weights = models.MobileNet_V3_Large_Weights.IMAGENET1K_V2 if pretrained else None
        model = models.mobilenet_v3_large(weights=weights)
        in_features = model.classifier[-1].in_features
        model.classifier[-1] = nn.Linear(in_features, num_classes)
    elif architecture == "efficientnet_b0":
        weights = models.EfficientNet_B0_Weights.IMAGENET1K_V1 if pretrained else None
        model = models.efficientnet_b0(weights=weights)
        in_features = model.classifier[-1].in_features
        model.classifier[-1] = nn.Linear(in_features, num_classes)
    else:
        raise ValueError(f"Unsupported architecture: {architecture}")
    return model


def head_parameters(model: nn.Module) -> list[nn.Parameter]:
    return list(model.classifier.parameters())  # type: ignore[union-attr]


def eval_transform() -> transforms.Compose:
    """Deterministic preprocessing. Mirrored exactly at inference time."""
    return transforms.Compose(
        [
            transforms.Resize(RESIZE, interpolation=transforms.InterpolationMode.BILINEAR),
            transforms.CenterCrop(CROP),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )


def train_transform() -> transforms.Compose:
    """Training-only augmentation.

    PlantVillage photos are single leaves on a plain background under even light.
    Fairly strong crop, rotation, colour and blur augmentation is used to make the
    model a little less dependent on those conditions; it does not make it robust
    to real garden photos (see the real-world evaluation in docs/MODEL_CARD.md).
    """
    return transforms.Compose(
        [
            transforms.RandomResizedCrop(CROP, scale=(0.45, 1.0), ratio=(0.8, 1.25)),
            transforms.RandomHorizontalFlip(),
            transforms.RandomVerticalFlip(),
            transforms.RandomApply([transforms.RandomRotation(25)], p=0.5),
            transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.25, hue=0.03),
            transforms.RandomApply([transforms.GaussianBlur(5, sigma=(0.1, 1.5))], p=0.2),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
            transforms.RandomErasing(p=0.15, scale=(0.02, 0.12)),
        ]
    )


def read_manifest(path: Path, split: str | None = None) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return [r for r in rows if split is None or r["split"] == split]


class ManifestDataset(Dataset):
    def __init__(self, root: Path, rows: list[dict[str, str]], classes: list[str], transform):
        self.root = root
        self.rows = rows
        self.index = {c: i for i, c in enumerate(classes)}
        self.transform = transform

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, i: int) -> tuple[torch.Tensor, int]:
        row = self.rows[i]
        with Image.open(self.root / row["path"]) as im:
            img = im.convert("RGB")
        label = self.index.get(row["label"], -1)
        return self.transform(img), label


@torch.no_grad()
def collect_logits(model: nn.Module, loader, device: str = "cpu") -> tuple[torch.Tensor, torch.Tensor]:
    model.eval()
    logits, labels = [], []
    for x, y in loader:
        logits.append(model(x.to(device)).float().cpu())
        labels.append(y)
    return torch.cat(logits), torch.cat(labels)


def energy_score(logits: torch.Tensor) -> torch.Tensor:
    """Free energy, -logsumexp(logits). Higher means less like the training data."""
    return -torch.logsumexp(logits, dim=1)
