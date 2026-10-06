"""Validation-based calibration and abstention thresholds."""

from __future__ import annotations

import numpy as np
import torch
from torch import nn


def fit_temperature(logits: torch.Tensor, labels: torch.Tensor, max_iter: int = 200) -> float:
    """Temperature scaling (Guo et al., 2017) fitted by minimising validation NLL."""
    log_t = torch.zeros(1, requires_grad=True)
    opt = torch.optim.LBFGS([log_t], lr=0.05, max_iter=max_iter)
    nll = nn.CrossEntropyLoss()

    def closure():
        opt.zero_grad()
        loss = nll(logits / log_t.exp(), labels)
        loss.backward()
        return loss

    opt.step(closure)
    return float(log_t.detach().exp().clamp(0.05, 20.0))


def expected_calibration_error(probs: np.ndarray, labels: np.ndarray, bins: int = 15) -> float:
    conf = probs.max(1)
    pred = probs.argmax(1)
    correct = (pred == labels).astype(float)
    edges = np.linspace(0, 1, bins + 1)
    ece = 0.0
    for lo, hi in zip(edges[:-1], edges[1:], strict=True):
        mask = (conf > lo) & (conf <= hi)
        if mask.any():
            ece += mask.mean() * abs(correct[mask].mean() - conf[mask].mean())
    return float(ece)


def selective_threshold(
    probs: np.ndarray, labels: np.ndarray, target_accuracy: float
) -> tuple[float, float, float]:
    """Smallest confidence threshold whose accepted validation predictions reach the
    target accuracy. Returns (threshold, coverage, accuracy_on_accepted).

    If no threshold reaches the target, the strictest one is returned and the caller
    records that the target was not met.
    """
    conf = probs.max(1)
    correct = probs.argmax(1) == labels
    order = np.argsort(-conf)
    conf_sorted, correct_sorted = conf[order], correct[order]
    cum_acc = np.cumsum(correct_sorted) / np.arange(1, len(conf_sorted) + 1)
    best = None
    for k in range(len(conf_sorted) - 1, -1, -1):
        if cum_acc[k] >= target_accuracy:
            best = k
            break
    if best is None:
        best = 0
    threshold = float(conf_sorted[best])
    accepted = conf >= threshold
    return threshold, float(accepted.mean()), float(correct[accepted].mean())
