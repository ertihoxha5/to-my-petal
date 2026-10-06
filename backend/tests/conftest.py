from __future__ import annotations

import io
import random
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import db as db_module
from app import models  # noqa: F401  (registers tables before create_all)
from app.config import get_settings
from app.db import Base
from app.inference.labels import LABELS
from app.inference.service import ModelMetadata, inference_service

HEADERS = {"X-Requested-With": "to-my-petal"}
PASSWORD = "correct horse battery"


@pytest.fixture(autouse=True)
def isolated_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    monkeypatch.setenv("TMP_DATABASE_URL", f"sqlite:///{(tmp_path / 'test.db').as_posix()}")
    monkeypatch.setenv("TMP_MEDIA_ROOT", str(tmp_path / "media"))
    monkeypatch.setenv("TMP_MODEL_DIR", str(tmp_path / "no-model"))
    get_settings.cache_clear()
    db_module.configure()
    Base.metadata.create_all(db_module.get_engine())
    inference_service.unload("No model found (test default).")
    yield tmp_path
    inference_service.unload("No model found (test default).")
    db_module.get_engine().dispose()
    get_settings.cache_clear()


@pytest.fixture
def app():
    from app.main import create_app

    return create_app(skip_model_load=True)


@pytest.fixture
def client(app) -> Iterator[TestClient]:
    with TestClient(app, headers=HEADERS) as c:
        yield c


@pytest.fixture
def make_client(app) -> Callable[[], TestClient]:
    clients: list[TestClient] = []

    def factory() -> TestClient:
        c = TestClient(app, headers=HEADERS)
        clients.append(c)
        return c

    yield factory
    for c in clients:
        c.close()


def register(client: TestClient, email: str = "ada@example.com", name: str = "Ada") -> dict:
    r = client.post(
        "/api/auth/register", json={"email": email, "password": PASSWORD, "display_name": name}
    )
    assert r.status_code == 201, r.text
    return r.json()


def leaf_jpeg(
    size: tuple[int, int] = (640, 480), seed: int = 1, fmt: str = "JPEG", **save_kw
) -> bytes:
    """A textured green image: sharp and bright enough to pass the quality checks."""
    rnd = random.Random(seed)
    img = Image.new("RGB", size, (70, 130, 60))
    px = img.load()
    for x in range(0, size[0], 4):
        for y in range(0, size[1], 4):
            v = rnd.randint(-60, 60)
            for dx in range(4):
                for dy in range(4):
                    if x + dx < size[0] and y + dy < size[1]:
                        px[x + dx, y + dy] = (max(0, 70 + v), max(0, 140 + v), max(0, 60 + v // 2))
    buf = io.BytesIO()
    img.save(buf, fmt, **save_kw)
    return buf.getvalue()


def create_plant(client: TestClient, species_key: str = "tomato", nickname: str = "Tomato") -> dict:
    r = client.post(
        "/api/plants", json={"nickname": nickname, "species": nickname, "species_key": species_key}
    )
    assert r.status_code == 201, r.text
    return r.json()


def upload(
    client: TestClient,
    plant_id: int,
    data: bytes | None = None,
    name: str = "leaf.jpg",
    mime: str = "image/jpeg",
):
    return client.post(
        "/api/photos",
        data={"plant_id": str(plant_id)},
        files={"file": (name, data if data is not None else leaf_jpeg(), mime)},
    )


CLASSES = list(LABELS)


def fake_metadata(**threshold_overrides) -> ModelMetadata:
    thresholds = {
        "confidence_min": 0.8,
        "energy_max": -5.0,
        "crop_mass_min": 0.6,
        **threshold_overrides,
    }
    return ModelMetadata.model_validate(
        {
            "schema_version": 1,
            "model_version": "test-model",
            "architecture": "mobilenet_v3_large",
            "num_classes": len(CLASSES),
            "classes": CLASSES,
            "preprocessing": {
                "color_mode": "RGB",
                "resize_shorter_side": 256,
                "center_crop": 224,
                "interpolation": "bilinear",
                "mean": [0.485, 0.456, 0.406],
                "std": [0.229, 0.224, 0.225],
            },
            "calibration": {"method": "temperature_scaling", "temperature": 1.0},
            "thresholds": thresholds,
            "weights_file": "model.pt",
            "weights_sha256": "0" * 64,
        }
    )


def logits_for(
    label: str, strength: float = 12.0, rest: float = 0.0, extra: dict[str, float] | None = None
):
    out = [rest] * len(CLASSES)
    out[CLASSES.index(label)] = strength
    for k, v in (extra or {}).items():
        out[CLASSES.index(k)] = v
    return out


@pytest.fixture
def fake_model() -> Callable[..., None]:
    def install(logits: list[float], **thresholds) -> None:
        inference_service.set_test_model(fake_metadata(**thresholds), lambda img: logits)

    return install
