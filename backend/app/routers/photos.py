from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db, utcnow
from ..models import Photo, Plant, User
from ..schemas import PhotoOut, PhotoUpdate
from ..security import current_user
from ..storage import ImageRejected, delete_files, safe_path, store_image
from .common import ensure_writable_plant, get_owned, photo_out

router = APIRouter(prefix="/api/photos", tags=["photos"])


def read_limited(upload: UploadFile) -> bytes:
    limit = get_settings().max_upload_bytes
    data = upload.file.read(limit + 1)
    if len(data) > limit:
        raise ImageRejected(
            "too_large",
            f"This photo is larger than {get_settings().max_upload_mb:g} MB. Please choose a smaller one.",
        )
    return data


def rejected(exc: ImageRejected) -> HTTPException:
    return HTTPException(
        status.HTTP_422_UNPROCESSABLE_CONTENT, {"code": exc.code, "message": exc.message}
    )


@router.post("", response_model=PhotoOut, status_code=status.HTTP_201_CREATED)
def upload_photo(
    file: UploadFile = File(...),
    plant_id: int = Form(...),
    taken_on: date | None = Form(None),
    description: str = Form("", max_length=300),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> PhotoOut:
    plant = get_owned(db, Plant, plant_id, user)
    ensure_writable_plant(plant)
    if taken_on and taken_on > date.today():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "The photo date can't be in the future."
        )
    try:
        stored = store_image(user.id, read_limited(file))
    except ImageRejected as exc:
        raise rejected(exc) from exc
    photo = Photo(
        user_id=user.id,
        plant_id=plant.id,
        storage_key=stored.storage_key,
        thumb_key=stored.thumb_key,
        width=stored.width,
        height=stored.height,
        size_bytes=stored.size_bytes,
        taken_on=taken_on or date.today(),
        description=description.strip(),
        created_at=utcnow(),
    )
    db.add(photo)
    try:
        db.flush()
        if plant.cover_photo_id is None:
            plant.cover_photo_id = photo.id
        db.commit()
    except Exception:
        db.rollback()
        delete_files([stored.storage_key, stored.thumb_key])
        raise
    db.refresh(photo)
    return photo_out(photo)


@router.get("", response_model=list[PhotoOut])
def list_photos(
    plant_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> list[PhotoOut]:
    get_owned(db, Plant, plant_id, user)
    photos = db.scalars(
        select(Photo)
        .where(Photo.user_id == user.id, Photo.plant_id == plant_id)
        .order_by(Photo.taken_on.desc(), Photo.id.desc())
    )
    return [photo_out(p) for p in photos]


@router.get("/{photo_id}", response_model=PhotoOut)
def get_photo(
    photo_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> PhotoOut:
    return photo_out(get_owned(db, Photo, photo_id, user))


@router.get("/{photo_id}/file")
def photo_file(
    photo_id: int,
    variant: Literal["full", "thumb"] = Query("full"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    photo = get_owned(db, Photo, photo_id, user)
    path = safe_path(photo.thumb_key if variant == "thumb" else photo.storage_key)
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This photo file is missing.")
    return FileResponse(
        path,
        media_type="image/jpeg",
        headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"},
    )


@router.patch("/{photo_id}", response_model=PhotoOut)
def update_photo(
    photo_id: int,
    data: PhotoUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> PhotoOut:
    photo = get_owned(db, Photo, photo_id, user)
    if photo.is_example:
        raise HTTPException(status.HTTP_409_CONFLICT, "Example photos are read-only.")
    if data.taken_on is not None:
        if data.taken_on > date.today():
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "The photo date can't be in the future."
            )
        photo.taken_on = data.taken_on
    if data.description is not None:
        photo.description = data.description.strip()
    db.commit()
    return photo_out(photo)


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo(
    photo_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> Response:
    photo = get_owned(db, Photo, photo_id, user)
    if photo.is_example:
        raise HTTPException(status.HTTP_409_CONFLICT, "Example photos are read-only.")
    keys = [photo.storage_key, photo.thumb_key]
    db.execute(update(Plant).where(Plant.cover_photo_id == photo.id).values(cover_photo_id=None))
    db.delete(photo)
    db.commit()
    delete_files(keys)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
