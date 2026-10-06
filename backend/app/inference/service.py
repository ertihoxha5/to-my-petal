"""Loads the classifier once per process and runs predictions.

A model directory must contain `metadata.json` (written by ml/tomypetal_ml/train.py)
and the weights it names. Before anything is served we check:
  * the metadata schema, architecture and preprocessing values,
  * that every class is in the app's label registry (so names can't be mismatched),
  * the SHA-256 of the weights file against the metadata,
  * strict state_dict loading and a test forward pass of the expected output size.
Any failure leaves the service in an honest "unavailable" state with a reason.
"""

from __future__ import annotations

import hashlib
import json
import logging
import threading
from pathlib import Path
from typing import Any, Literal

from PIL import Image
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

from .decision import ModelThresholds
from .labels import LABELS
from .schemas import ModelInfo

log = logging.getLogger(__name__)

ALLOWED_ARCHITECTURES = ("mobilenet_v3_large", "efficientnet_b0")


class Preprocessing(BaseModel):
    color_mode: Literal["RGB"]
    resize_shorter_side: int = Field(ge=32, le=1024)
    center_crop: int = Field(ge=32, le=1024)
    interpolation: Literal["bilinear"]
    mean: list[float] = Field(min_length=3, max_length=3)
    std: list[float] = Field(min_length=3, max_length=3)

    @model_validator(mode="after")
    def _crop_fits(self) -> Preprocessing:
        if self.center_crop > self.resize_shorter_side:
            raise ValueError("center_crop larger than resize")
        if any(s <= 0 for s in self.std):
            raise ValueError("std must be positive")
        return self


class Calibration(BaseModel):
    method: Literal["temperature_scaling"]
    temperature: float = Field(gt=0.01, lt=100)


class Thresholds(BaseModel):
    confidence_min: float = Field(gt=0, lt=1)
    energy_max: float
    crop_mass_min: float = Field(gt=0, le=1)


class ModelMetadata(BaseModel):
    schema_version: Literal[1]
    model_version: str = Field(min_length=1, max_length=80)
    architecture: str
    num_classes: int
    classes: list[str]
    preprocessing: Preprocessing
    calibration: Calibration
    thresholds: Thresholds
    weights_file: str
    weights_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")

    @field_validator("architecture")
    @classmethod
    def _arch(cls, v: str) -> str:
        if v not in ALLOWED_ARCHITECTURES:
            raise ValueError(f"architecture {v!r} is not supported")
        return v

    @field_validator("weights_file")
    @classmethod
    def _plain_name(cls, v: str) -> str:
        if "/" in v or "\\" in v or v.startswith("."):
            raise ValueError("weights_file must be a plain file name")
        return v

    @model_validator(mode="after")
    def _classes(self) -> ModelMetadata:
        if len(self.classes) != self.num_classes or len(set(self.classes)) != len(self.classes):
            raise ValueError("classes do not match num_classes or contain duplicates")
        unknown = [c for c in self.classes if c not in LABELS]
        if unknown:
            raise ValueError(f"classes unknown to the app: {unknown}")
        return self


class InferenceService:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model: Any = None
        self._transform: Any = None
        self._override: Any = None
        self.metadata: ModelMetadata | None = None
        self.metrics: dict[str, Any] = {}
        self.unavailable_reason: str | None = "The model has not been loaded yet."

    @property
    def available(self) -> bool:
        return self._model is not None and self.metadata is not None

    def info(self) -> ModelInfo:
        def f1(key: str) -> float | None:
            v = self.metrics.get(key, {}).get("macro_f1")
            return float(v) if isinstance(v, int | float) else None

        if not self.available:
            return ModelInfo(available=False, unavailable_reason=self.unavailable_reason)
        assert self.metadata is not None
        return ModelInfo(
            available=True,
            version=self.metadata.model_version,
            controlled_test_macro_f1=f1("controlled_test"),
            real_world_macro_f1=f1("real_world"),
        )

    def thresholds(self) -> ModelThresholds:
        assert self.metadata is not None
        return ModelThresholds(
            temperature=self.metadata.calibration.temperature,
            confidence_min=self.metadata.thresholds.confidence_min,
            energy_max=self.metadata.thresholds.energy_max,
            crop_mass_min=self.metadata.thresholds.crop_mass_min,
        )

    def unload(self, reason: str) -> None:
        self._model = None
        self._override = None
        self.metadata = None
        self.metrics = {}
        self.unavailable_reason = reason

    def load(self, model_dir: Path, torch_threads: int = 0) -> None:
        with self._lock:
            self.unload("The model has not been loaded yet.")
            meta_path = model_dir / "metadata.json"
            if not meta_path.is_file():
                self.unavailable_reason = (
                    f"No model found (expected {meta_path.name} in the configured model folder)."
                )
                log.warning("Inference unavailable: %s (%s)", self.unavailable_reason, model_dir)
                return
            try:
                meta = ModelMetadata.model_validate_json(meta_path.read_text(encoding="utf-8"))
            except (ValidationError, ValueError) as exc:
                self.unavailable_reason = "The model's metadata failed validation."
                log.error("Model metadata invalid: %s", exc)
                return
            weights = model_dir / meta.weights_file
            if not weights.is_file():
                self.unavailable_reason = "The model weights file is missing."
                return
            if hashlib.sha256(weights.read_bytes()).hexdigest() != meta.weights_sha256:
                self.unavailable_reason = "The model weights do not match their metadata checksum."
                return
            try:
                import torch
                from torchvision import models, transforms
            except ImportError:
                self.unavailable_reason = "PyTorch is not installed on this server."
                log.warning("Inference unavailable: torch not installed")
                return
            try:
                if torch_threads:
                    torch.set_num_threads(torch_threads)
                if meta.architecture == "mobilenet_v3_large":
                    net = models.mobilenet_v3_large(weights=None)
                else:
                    net = models.efficientnet_b0(weights=None)
                net.classifier[-1] = torch.nn.Linear(
                    net.classifier[-1].in_features, meta.num_classes
                )
                state = torch.load(weights, map_location="cpu", weights_only=True)
                net.load_state_dict(state, strict=True)
                net.eval()
                p = meta.preprocessing
                tf = transforms.Compose(
                    [
                        transforms.Resize(
                            p.resize_shorter_side,
                            interpolation=transforms.InterpolationMode.BILINEAR,
                        ),
                        transforms.CenterCrop(p.center_crop),
                        transforms.ToTensor(),
                        transforms.Normalize(p.mean, p.std),
                    ]
                )
                with torch.inference_mode():
                    out = net(torch.zeros(1, 3, p.center_crop, p.center_crop))
                if tuple(out.shape) != (1, meta.num_classes):
                    raise ValueError(f"unexpected output shape {tuple(out.shape)}")
            except Exception as exc:  # noqa: BLE001 - any failure means "unavailable"
                self.unavailable_reason = "The model could not be loaded."
                log.exception("Model load failed: %s", exc)
                return
            metrics_path = model_dir / "metrics.json"
            if metrics_path.is_file():
                try:
                    self.metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
                except ValueError:
                    self.metrics = {}
            self._model, self._transform, self.metadata = net, tf, meta
            self.unavailable_reason = None
            log.info("Loaded model %s (%d classes)", meta.model_version, meta.num_classes)

    def logits(self, image: Image.Image) -> list[float]:
        if not self.available:
            raise RuntimeError("model unavailable")
        if self._override is not None:
            return list(self._override(image))
        import torch

        x = self._transform(image.convert("RGB")).unsqueeze(0)
        with torch.inference_mode():
            out = self._model(x)[0]
        return [float(v) for v in out]

    def set_test_model(
        self, metadata: ModelMetadata, fn: Any, metrics: dict[str, Any] | None = None
    ) -> None:
        """Install a stand-in predictor (tests only): `fn(image) -> list[float]`."""
        self.metadata = metadata
        self.metrics = metrics or {}
        self._model = self._override = fn
        self.unavailable_reason = None


inference_service = InferenceService()
