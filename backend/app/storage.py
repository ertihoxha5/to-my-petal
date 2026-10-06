"""Validated image storage.

Uploads are never written as received. Each file is decoded with Pillow, checked
for format, byte size and decoded dimensions, orientation-corrected, stripped of
metadata (EXIF can contain GPS coordinates) and re-encoded as JPEG under a random
name inside the user's directory.
"""

from __future__ import annotations

import io
import secrets
import warnings
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from .config import get_settings

ALLOWED_FORMATS = {"JPEG": "JPEG", "PNG": "PNG", "WEBP": "WebP", "MPO": "JPEG"}


class ImageRejected(ValueError):
    """Raised with a message that is safe and useful to show to the user."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class StoredImage:
    storage_key: str
    thumb_key: str
    width: int
    height: int
    size_bytes: int
    image: Image.Image  # RGB, orientation-corrected, full stored resolution


def media_root() -> Path:
    root = get_settings().media_root.resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def safe_path(key: str) -> Path:
    """Resolve a storage key to a path, refusing anything outside MEDIA_ROOT."""
    root = media_root()
    path = (root / key).resolve()
    if not path.is_relative_to(root) or path == root:
        raise ValueError("Invalid storage key")
    return path


def decode_upload(data: bytes) -> Image.Image:
    s = get_settings()
    if len(data) == 0:
        raise ImageRejected("empty", "The file is empty. Please choose a photo.")
    if len(data) > s.max_upload_bytes:
        raise ImageRejected(
            "too_large", f"This photo is larger than {s.max_upload_mb:g} MB. Please choose a smaller one."
        )
    Image.MAX_IMAGE_PIXELS = s.max_image_pixels
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as probe:
                fmt = probe.format or ""
                probe.verify()
            img = Image.open(io.BytesIO(data))
            img.load()
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ImageRejected("too_many_pixels", "This image has too many pixels to process safely.") from exc
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise ImageRejected(
            "not_an_image",
            "We couldn't read this file as a photo. JPEG, PNG and WebP images are supported.",
        ) from exc
    if fmt not in ALLOWED_FORMATS:
        raise ImageRejected(
            "unsupported_format",
            f"{fmt or 'This'} images aren't supported yet. Please use JPEG, PNG or WebP "
            "(on iPhone, choose 'Most Compatible' in camera settings or share as JPEG).",
        )
    w, h = img.size
    if min(w, h) < s.min_image_side:
        raise ImageRejected(
            "too_small",
            f"This photo is only {w}×{h} pixels. Please use one at least {s.min_image_side} pixels on each side.",
        )
    if max(w, h) > s.max_image_side:
        raise ImageRejected("too_big_dimensions", f"This photo is {w}×{h} pixels, which is larger than we accept.")
    img = ImageOps.exif_transpose(img) or img
    if img.mode in ("RGBA", "LA", "P"):
        rgba = img.convert("RGBA")
        bg = Image.new("RGB", rgba.size, (255, 252, 245))
        bg.paste(rgba, mask=rgba.getchannel("A"))
        img = bg
    else:
        img = img.convert("RGB")
    return img


def store_image(user_id: int, data: bytes) -> StoredImage:
    img = decode_upload(data)
    s = get_settings()
    full = img.copy()
    full.thumbnail((s.stored_max_side, s.stored_max_side), Image.Resampling.LANCZOS)
    thumb = img.copy()
    thumb.thumbnail((s.thumb_max_side, s.thumb_max_side), Image.Resampling.LANCZOS)

    name = secrets.token_hex(16)
    key = f"u{int(user_id)}/{name}.jpg"
    thumb_key = f"u{int(user_id)}/{name}_t.jpg"
    path, tpath = safe_path(key), safe_path(thumb_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    full.save(path, "JPEG", quality=88, optimize=True, progressive=True)
    thumb.save(tpath, "JPEG", quality=82, optimize=True, progressive=True)
    return StoredImage(key, thumb_key, full.width, full.height, path.stat().st_size, full)


def copy_example_image(user_id: int, source: Path) -> StoredImage:
    return store_image(user_id, source.read_bytes())


def delete_files(keys: list[str]) -> None:
    for key in keys:
        try:
            safe_path(key).unlink(missing_ok=True)
        except (ValueError, OSError):
            continue


def delete_user_dir(user_id: int) -> None:
    d = safe_path(f"u{int(user_id)}")
    if d.is_dir():
        for p in d.iterdir():
            p.unlink(missing_ok=True)
        d.rmdir()
