from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Outcome = Literal[
    "possible_issue",
    "no_known_issue",
    "inconclusive",
    "unsupported_species",
    "unsupported_image",
    "model_unavailable",
]
Strength = Literal["closer", "partial", "weak"]


class Hypothesis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    crop: str
    condition: str
    healthy: bool
    guide_slug: str
    summary: str
    strength: Strength
    # Temperature-scaled softmax over the model's classes. Calibrated on lab-style
    # validation photos only, so it is not "the chance this diagnosis is right".
    calibrated_score: float = Field(ge=0.0, le=1.0)


class ImageQuality(BaseModel):
    model_config = ConfigDict(extra="forbid")

    brightness: float = Field(ge=0.0, le=1.0)
    sharpness: float = Field(ge=0.0)
    issues: list[Literal["too_dark", "too_bright", "blurry"]] = []


class ModelInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    available: bool
    version: str | None = None
    unavailable_reason: str | None = None
    controlled_test_macro_f1: float | None = None
    real_world_macro_f1: float | None = None


class AnalysisResult(BaseModel):
    """The validated document stored in Analysis.result and returned to clients."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1] = 1
    outcome: Outcome
    headline: str
    explanation: str
    primary: Hypothesis | None = None
    alternatives: list[Hypothesis] = Field(default_factory=list, max_length=3)
    reasons: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    quality: ImageQuality | None = None
    model: ModelInfo

    @model_validator(mode="after")
    def _consistent(self) -> AnalysisResult:
        if self.outcome in ("possible_issue", "no_known_issue"):
            if self.primary is None:
                raise ValueError("a finding needs a primary hypothesis")
            if self.outcome == "possible_issue" and self.primary.healthy:
                raise ValueError("possible_issue cannot have a healthy primary hypothesis")
            if self.outcome == "no_known_issue" and not self.primary.healthy:
                raise ValueError("no_known_issue needs a healthy primary hypothesis")
        if self.outcome in ("unsupported_species", "model_unavailable") and (
            self.primary or self.alternatives
        ):
            raise ValueError(f"{self.outcome} must not carry predictions")
        if self.outcome == "model_unavailable" and self.model.available:
            raise ValueError("model_unavailable with an available model")
        return self
