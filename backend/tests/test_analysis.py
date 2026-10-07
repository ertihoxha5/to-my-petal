from __future__ import annotations

import io
import json

import pytest
from PIL import Image
from pydantic import ValidationError

from app.inference.decision import assess_quality
from app.inference.schemas import AnalysisResult, ModelInfo
from app.inference.service import InferenceService

from .conftest import CLASSES, create_plant, logits_for, register, upload


@pytest.fixture
def tomato_photo(client):
    register(client)
    plant = create_plant(client, "tomato")
    return upload(client, plant["id"]).json()


def analyse(client, photo_id, **context):
    r = client.post("/api/analyses", json={"photo_id": photo_id, **context})
    assert r.status_code == 201, r.text
    return r.json()


def test_model_unavailable_is_honest(client, tomato_photo):
    a = analyse(client, tomato_photo["id"])
    assert a["outcome"] == "model_unavailable"
    assert a["result"]["primary"] is None and a["result"]["alternatives"] == []
    assert a["result"]["model"]["available"] is False
    assert a["result"]["model"]["unavailable_reason"]
    assert client.get("/api/system/model").json()["available"] is False


def test_unsupported_species_never_runs_model(client, fake_model):
    calls = []
    from app.inference.service import inference_service

    fake_model(logits_for("Tomato___healthy"))
    inference_service._override = lambda img: calls.append(1) or logits_for("Tomato___healthy")
    register(client)
    basil = create_plant(client, "basil", "Basil")
    photo = upload(client, basil["id"]).json()
    a = analyse(client, photo["id"])
    assert a["outcome"] == "unsupported_species"
    assert a["result"]["headline"] == "This plant is not supported yet"
    assert a["result"]["primary"] is None
    assert calls == []


def test_possible_issue_with_alternative(client, tomato_photo, fake_model):
    fake_model(logits_for("Tomato___Early_blight", 9.0, extra={"Tomato___Target_Spot": 7.0}))
    a = analyse(
        client, tomato_photo["id"], watering="daily", light="full_sun", symptoms_started="this_week"
    )
    res = a["result"]
    assert a["outcome"] == "possible_issue"
    assert res["headline"] == "Possible early blight"
    assert res["explanation"].startswith("The model suggests")
    assert res["primary"]["label"] == "Tomato___Early_blight"
    assert res["primary"]["guide_slug"] == "early-blight"
    assert [h["label"] for h in res["alternatives"]] == ["Tomato___Target_Spot"]
    assert res["limitations"], "limitations must always accompany a finding"
    # User context and curated notes are returned separately from the model output.
    assert a["context"]["watering"] == "daily"
    assert all(n["source"] == "care_guide" for n in a["context_notes"])
    assert any("water at the base" in n["text"] for n in a["context_notes"])


def test_no_known_issue(client, tomato_photo, fake_model):
    fake_model(logits_for("Tomato___healthy"))
    a = analyse(client, tomato_photo["id"])
    assert a["outcome"] == "no_known_issue"
    assert "only checks for the few conditions" in a["result"]["explanation"]


def test_low_confidence_is_inconclusive_with_closest_matches(client, tomato_photo, fake_model):
    fake_model(logits_for("Tomato___Early_blight", 9.0, extra={"Tomato___Septoria_leaf_spot": 9.0}))
    a = analyse(client, tomato_photo["id"])
    assert a["outcome"] == "inconclusive"
    assert a["result"]["primary"] is None
    assert a["result"]["reasons"] == ["low_confidence"]
    assert {h["label"] for h in a["result"]["alternatives"]} == {
        "Tomato___Early_blight",
        "Tomato___Septoria_leaf_spot",
    }


def test_unfamiliar_image_is_rejected_even_without_quality_issues(client, tomato_photo, fake_model):
    fake_model([0.0] * len(CLASSES))  # flat logits: high energy
    a = analyse(client, tomato_photo["id"])
    assert a["outcome"] == "unsupported_image"
    assert a["result"]["primary"] is None and a["result"]["alternatives"] == []


def test_crop_mismatch_is_inconclusive(client, tomato_photo, fake_model):
    fake_model(logits_for("Potato___Late_blight", 14.0))
    a = analyse(client, tomato_photo["id"])
    assert a["outcome"] == "inconclusive" and a["result"]["reasons"] == ["crop_mismatch"]
    assert "potato" in a["result"]["explanation"]


def test_dark_photo_is_inconclusive(client, fake_model):
    register(client)
    plant = create_plant(client, "tomato")
    buf = io.BytesIO()
    Image.new("RGB", (400, 400), (5, 6, 5)).save(buf, "JPEG")
    photo = upload(client, plant["id"], data=buf.getvalue()).json()
    fake_model(logits_for("Tomato___Early_blight"))
    a = analyse(client, photo["id"])
    assert a["outcome"] == "inconclusive"
    assert "quality_too_dark" in a["result"]["reasons"]


def test_rerun_after_model_becomes_available(client, tomato_photo, fake_model):
    a = analyse(client, tomato_photo["id"])
    assert a["outcome"] == "model_unavailable"
    fake_model(logits_for("Tomato___Leaf_Mold"))
    r = client.post(f"/api/analyses/{a['id']}/rerun")
    assert r.status_code == 200 and r.json()["outcome"] == "possible_issue"


def test_corrections_and_notes(client, tomato_photo, fake_model):
    fake_model(logits_for("Tomato___Leaf_Mold"))
    a = analyse(client, tomato_photo["id"])
    r = client.patch(
        f"/api/analyses/{a['id']}",
        json={"user_correction": "Turned out to be sunscald", "user_notes": "Moved to shade"},
    )
    assert r.json()["user_correction"] == "Turned out to be sunscald"
    assert (
        r.json()["result"]["primary"]["label"] == "Tomato___Leaf_Mold"
    )  # model output is not overwritten


# ---- Response validation ---------------------------------------------------------


def _info(available=True):
    return ModelInfo(available=available, version="v" if available else None)


def test_result_schema_rejects_inconsistent_documents():
    hyp = {
        "label": "Tomato___healthy",
        "crop": "tomato",
        "condition": "No known issue",
        "healthy": True,
        "guide_slug": "tomato-care",
        "summary": "s",
        "strength": "closer",
        "calibrated_score": 0.9,
    }
    with pytest.raises(ValidationError):  # issue outcome with healthy hypothesis
        AnalysisResult(
            outcome="possible_issue", headline="h", explanation="e", primary=hyp, model=_info()
        )
    with pytest.raises(ValidationError):  # finding without hypothesis
        AnalysisResult(outcome="possible_issue", headline="h", explanation="e", model=_info())
    with pytest.raises(ValidationError):  # unavailable cannot carry predictions
        AnalysisResult(
            outcome="model_unavailable",
            headline="h",
            explanation="e",
            primary=hyp,
            model=_info(False),
        )
    with pytest.raises(ValidationError):  # scores must be probabilities
        AnalysisResult(
            outcome="no_known_issue",
            headline="h",
            explanation="e",
            primary={**hyp, "calibrated_score": 1.5},
            model=_info(),
        )
    with pytest.raises(ValidationError):  # unknown fields are refused
        AnalysisResult(
            outcome="inconclusive", headline="h", explanation="e", model=_info(), accuracy=0.99
        )


def test_quality_heuristics():
    sharp = Image.effect_noise((300, 300), 80).convert("RGB")
    assert assess_quality(sharp).issues == []
    flat = Image.new("RGB", (300, 300), (120, 160, 110))
    assert "blurry" in assess_quality(flat).issues


# ---- Model loading validation ----------------------------------------------------


def _write_model_dir(tmp_path, **overrides):
    meta = {
        "schema_version": 1,
        "model_version": "x",
        "architecture": "mobilenet_v3_large",
        "num_classes": len(CLASSES),
        "classes": CLASSES,
        "preprocessing": {
            "color_mode": "RGB",
            "resize_shorter_side": 256,
            "center_crop": 224,
            "interpolation": "bilinear",
            "mean": [0.5] * 3,
            "std": [0.2] * 3,
        },
        "calibration": {"method": "temperature_scaling", "temperature": 1.2},
        "thresholds": {"confidence_min": 0.8, "energy_max": -4.0, "crop_mass_min": 0.6},
        "weights_file": "model.pt",
        "weights_sha256": "a" * 64,
        **overrides,
    }
    d = tmp_path / "model"
    d.mkdir(exist_ok=True)
    (d / "metadata.json").write_text(json.dumps(meta))
    (d / "model.pt").write_bytes(b"not really weights")
    return d


def test_missing_model_dir_reports_unavailable(tmp_path):
    svc = InferenceService()
    svc.load(tmp_path / "nothing")
    assert not svc.available and "No model found" in svc.unavailable_reason


def test_unknown_labels_are_refused(tmp_path):
    svc = InferenceService()
    svc.load(_write_model_dir(tmp_path, classes=[*CLASSES[:-1], "Apple___healthy"]))
    assert not svc.available and svc.unavailable_reason == "The model's metadata failed validation."


def test_unsupported_architecture_is_refused(tmp_path):
    svc = InferenceService()
    svc.load(_write_model_dir(tmp_path, architecture="resnet9000"))
    assert not svc.available


def test_checksum_mismatch_is_refused(tmp_path):
    svc = InferenceService()
    svc.load(_write_model_dir(tmp_path))
    assert not svc.available and "checksum" in svc.unavailable_reason


def test_weights_path_traversal_is_refused(tmp_path):
    svc = InferenceService()
    svc.load(_write_model_dir(tmp_path, weights_file="../evil.pt"))
    assert not svc.available


def test_real_torch_model_loads_and_predicts(tmp_path):
    torch = pytest.importorskip("torch")
    from torchvision import models

    net = models.mobilenet_v3_large(weights=None)
    net.classifier[-1] = torch.nn.Linear(net.classifier[-1].in_features, len(CLASSES))
    d = tmp_path / "model"
    d.mkdir()
    torch.save(net.state_dict(), d / "model.pt")
    import hashlib

    sha = hashlib.sha256((d / "model.pt").read_bytes()).hexdigest()
    _write_model_dir(tmp_path, weights_sha256=sha)
    torch.save(net.state_dict(), d / "model.pt")  # _write_model_dir overwrote the weights file
    svc = InferenceService()
    svc.load(d)
    assert svc.available, svc.unavailable_reason
    logits = svc.logits(Image.new("RGB", (300, 200), (60, 140, 60)))
    assert len(logits) == len(CLASSES)
    assert svc.info().version == "x"
