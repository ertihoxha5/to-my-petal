from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..db import get_db, utcnow
from ..models import Photo, Plant, User
from ..schemas import PlantIn, PlantOut, PlantUpdate
from ..security import current_user
from ..storage import delete_files
from .common import ensure_writable_plant, entry_stats, get_owned, plant_out

router = APIRouter(prefix="/api/plants", tags=["plants"])


@router.get("", response_model=list[PlantOut])
def list_plants(
    q: str = Query("", max_length=80),
    species_key: str | None = None,
    state: Literal["active", "archived", "all"] = "active",
    examples: bool = True,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[PlantOut]:
    stmt = select(Plant).where(Plant.user_id == user.id)
    if state == "active":
        stmt = stmt.where(Plant.archived_at.is_(None))
    elif state == "archived":
        stmt = stmt.where(Plant.archived_at.is_not(None))
    if species_key:
        stmt = stmt.where(Plant.species_key == species_key)
    if not examples:
        stmt = stmt.where(Plant.is_example.is_(False))
    if q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(Plant.nickname.ilike(like), Plant.species.ilike(like), Plant.location.ilike(like))
        )
    plants = list(db.scalars(stmt.order_by(Plant.is_example, Plant.nickname)))
    stats = entry_stats(db, [p.id for p in plants])
    return [plant_out(p, stats) for p in plants]


@router.post("", response_model=PlantOut, status_code=status.HTTP_201_CREATED)
def create_plant(
    data: PlantIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> PlantOut:
    plant = Plant(user_id=user.id, **data.model_dump())
    db.add(plant)
    db.commit()
    db.refresh(plant)
    return plant_out(plant, {})


@router.get("/{plant_id}", response_model=PlantOut)
def get_plant(
    plant_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> PlantOut:
    plant = get_owned(db, Plant, plant_id, user)
    return plant_out(plant, entry_stats(db, [plant.id]))


@router.patch("/{plant_id}", response_model=PlantOut)
def update_plant(
    plant_id: int,
    data: PlantUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> PlantOut:
    plant = get_owned(db, Plant, plant_id, user)
    ensure_writable_plant(plant)
    changes = data.model_dump(exclude_unset=True)
    archived = changes.pop("archived", None)
    if "cover_photo_id" in changes and changes["cover_photo_id"] is not None:
        photo = get_owned(db, Photo, changes["cover_photo_id"], user)
        if photo.plant_id != plant.id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "That photo belongs to a different plant."
            )
    for k, v in changes.items():
        if k in ("nickname", "species_key") and v is None:
            continue
        setattr(plant, k, v if v is not None or k in ("acquired_on", "cover_photo_id") else "")
    if archived is not None:
        plant.archived_at = utcnow() if archived else None
    db.commit()
    db.refresh(plant)
    return plant_out(plant, entry_stats(db, [plant.id]))


@router.delete("/{plant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plant(
    plant_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> Response:
    plant = get_owned(db, Plant, plant_id, user)
    keys = [k for p in plant.photos for k in (p.storage_key, p.thumb_key)]
    plant.cover_photo_id = None
    db.flush()
    db.delete(plant)
    db.commit()
    delete_files(keys)  # only after the rows are gone
    return Response(status_code=status.HTTP_204_NO_CONTENT)
