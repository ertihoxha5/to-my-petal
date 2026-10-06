from __future__ import annotations

import io
import re

import pytest
from PIL import Image

from app.config import get_settings
from app.storage import safe_path

from .conftest import create_plant, leaf_jpeg, register, upload


@pytest.fixture
def plant(client):
    register(client)
    return create_plant(client)


def detail(r):
    return r.json()["detail"]


def test_valid_jpeg_is_reencoded_with_safe_name(client, plant):
    r = upload(client, plant["id"], name="../../etc/passwd.jpg")
    assert r.status_code == 201, r.text
    photo = r.json()
    assert photo["url"] == f"/api/photos/{photo['id']}/file"
    from sqlalchemy import select

    from app.db import get_db
    from app.models import Photo

    row = next(get_db()).scalar(select(Photo))
    assert re.fullmatch(r"u\d+/[0-9a-f]{32}\.jpg", row.storage_key)
    assert "passwd" not in row.storage_key
    f = client.get(photo["url"])
    assert f.status_code == 200 and f.headers["content-type"] == "image/jpeg"
    assert f.headers["cache-control"].startswith("private")


def test_first_photo_becomes_cover(client, plant):
    photo = upload(client, plant["id"]).json()
    assert client.get(f"/api/plants/{plant['id']}").json()["cover"]["id"] == photo["id"]


def test_rejects_non_image(client, plant):
    r = upload(client, plant["id"], data=b"<script>alert(1)</script>", name="x.jpg")
    assert r.status_code == 422 and detail(r)["code"] == "not_an_image"


def test_rejects_disguised_file_by_content_not_extension(client, plant):
    r = upload(client, plant["id"], data=b"%PDF-1.4 fake pdf", name="leaf.png", mime="image/png")
    assert r.status_code == 422 and detail(r)["code"] == "not_an_image"


def test_rejects_unsupported_format(client, plant):
    buf = io.BytesIO()
    Image.new("RGB", (300, 300), "green").save(buf, "BMP")
    r = upload(client, plant["id"], data=buf.getvalue(), name="leaf.bmp", mime="image/bmp")
    assert r.status_code == 422 and detail(r)["code"] == "unsupported_format"


def test_rejects_tiny_image(client, plant):
    r = upload(client, plant["id"], data=leaf_jpeg((60, 60)))
    assert r.status_code == 422 and detail(r)["code"] == "too_small"
    assert "60×60" in detail(r)["message"]


def test_rejects_empty_file(client, plant):
    r = upload(client, plant["id"], data=b"")
    assert r.status_code == 422 and detail(r)["code"] == "empty"


def test_rejects_large_file(client, plant, monkeypatch):
    monkeypatch.setenv("TMP_MAX_UPLOAD_MB", "0.01")
    get_settings.cache_clear()
    r = upload(client, plant["id"], data=leaf_jpeg((800, 800), quality=100))
    assert r.status_code == 422 and detail(r)["code"] == "too_large"


def test_rejects_decompression_bomb(client, plant, monkeypatch):
    monkeypatch.setenv("TMP_MAX_IMAGE_PIXELS", "100000")
    get_settings.cache_clear()
    buf = io.BytesIO()
    Image.new("RGB", (1000, 1000), "green").save(buf, "PNG")  # 1 MP, compresses to almost nothing
    r = upload(client, plant["id"], data=buf.getvalue(), name="bomb.png", mime="image/png")
    assert r.status_code == 422 and detail(r)["code"] == "too_many_pixels"


def test_png_with_alpha_and_exif_is_cleaned(client, plant):
    img = Image.new("RGBA", (400, 300), (40, 120, 50, 128))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    r = upload(client, plant["id"], data=buf.getvalue(), name="leaf.png", mime="image/png")
    assert r.status_code == 201

    exif = Image.Exif()
    exif[0x0112] = 6  # orientation: rotate 90°
    exif[0x010F] = "SecretCam"
    r = upload(client, plant["id"], data=leaf_jpeg((400, 200), exif=exif.tobytes()))
    assert r.status_code == 201
    photo = r.json()
    assert (photo["width"], photo["height"]) == (200, 400)  # orientation applied
    stored = Image.open(io.BytesIO(client.get(photo["url"]).content))
    assert not stored.getexif()  # metadata stripped


def test_future_photo_date_rejected(client, plant):
    r = client.post(
        "/api/photos",
        data={"plant_id": str(plant["id"]), "taken_on": "2999-01-01"},
        files={"file": ("a.jpg", leaf_jpeg(), "image/jpeg")},
    )
    assert r.status_code == 422


def test_safe_path_blocks_traversal():
    with pytest.raises(ValueError):
        safe_path("../outside.jpg")
    with pytest.raises(ValueError):
        safe_path("u1/../../outside.jpg")


def test_deleting_photo_removes_files(client, plant):
    photo = upload(client, plant["id"]).json()
    from sqlalchemy import select

    from app.db import get_db
    from app.models import Photo

    row = next(get_db()).scalar(select(Photo))
    full, thumb = safe_path(row.storage_key), safe_path(row.thumb_key)
    assert full.exists() and thumb.exists()
    assert client.delete(f"/api/photos/{photo['id']}").status_code == 204
    assert not full.exists() and not thumb.exists()
    assert client.get(f"/api/plants/{plant['id']}").json()["cover"] is None
