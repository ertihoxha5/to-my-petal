from __future__ import annotations

import numpy as np
import torch

from tomypetal_ml.calibration import (
    expected_calibration_error,
    fit_temperature,
    selective_threshold,
)
from tomypetal_ml.classes import TARGET_CLASSES, crop_of
from tomypetal_ml.prepare_dataset import (
    UnionFind,
    leaf_map_key,
    resolve_leaf_group,
    split_groups,
)


def test_leaf_map_key_matches_dataset_naming():
    assert leaf_map_key("0a0d6a11-ddd6-4dac___RS_Erly.B 7554.JPG") == "rs_erly.b 7554"
    assert leaf_map_key("abc___GCREC_Bact.Sp 3110 copy.jpg") == "gcrec_bact.sp 3110"
    assert (
        leaf_map_key("abc___Com.G_SpM_FL 8810_final_masked.jpg") == "com.g_spm_fl 8810"
    )


def test_resolve_leaf_group_prefers_matching_class():
    leaf_map = {"x 1": ["Apple___healthy:::3.0", "Tomato___healthy:::7.0"]}
    assert (
        resolve_leaf_group("Tomato___healthy", "u___X 1.JPG", leaf_map)
        == "Tomato___healthy:::7.0"
    )
    assert resolve_leaf_group("Potato___healthy", "u___X 1.JPG", leaf_map) is None


def test_split_never_separates_a_group_and_hits_fractions():
    groups = {
        "A": {f"a{i}": 4 for i in range(100)},
        "B": {f"b{i}": 1 for i in range(30)},
    }
    assignment = split_groups(groups, (0.7, 0.15, 0.15), seed=1)
    assert set(assignment) == set(groups["A"]) | set(groups["B"])
    counts = {
        s: sum(4 for g, v in assignment.items() if v == s and g.startswith("a"))
        for s in ("train", "val", "test")
    }
    assert (
        abs(counts["train"] / 400 - 0.7) < 0.05
        and counts["val"] > 0
        and counts["test"] > 0
    )
    assert split_groups(groups, (0.7, 0.15, 0.15), seed=1) == assignment  # reproducible


def test_union_find_merges_duplicates():
    uf = UnionFind()
    uf.union("img:1", "leaf:a")
    uf.union("img:2", "img:1")
    assert uf.find("img:2") == uf.find("leaf:a")


def test_temperature_scaling_reduces_overconfidence():
    torch.manual_seed(0)
    labels = torch.randint(0, 3, (600,))
    logits = torch.randn(600, 3) * 0.5
    logits[torch.arange(600), labels] += 1.0
    overconfident = logits * 6
    t = fit_temperature(overconfident, labels)
    nll = torch.nn.CrossEntropyLoss()
    grid_best = min(
        (nll(overconfident / g, labels).item(), g) for g in np.arange(0.5, 20, 0.05)
    )[1]
    assert abs(t - grid_best) < 0.06  # matches a brute-force search for the optimum
    before = expected_calibration_error(
        torch.softmax(overconfident, 1).numpy(), labels.numpy()
    )
    after = expected_calibration_error(
        torch.softmax(overconfident / t, 1).numpy(), labels.numpy()
    )
    assert after < before


def test_selective_threshold_reaches_target_on_accepted():
    rng = np.random.default_rng(0)
    probs = rng.dirichlet(np.ones(4), size=500)
    labels = np.where(
        rng.random(500) < probs.max(1), probs.argmax(1), (probs.argmax(1) + 1) % 4
    )
    t, coverage, acc = selective_threshold(probs, labels, 0.9)
    assert 0 < coverage <= 1 and acc >= 0.9 - 1e-9 and 0 < t <= 1


def test_class_subset_is_tomato_potato_pepper_only():
    assert len(TARGET_CLASSES) == 15
    assert {crop_of(c) for c in TARGET_CLASSES} == {"tomato", "potato", "pepper_bell"}
