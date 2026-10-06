from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..models import Analysis, JournalEntry, Photo, Plant, User
from ..schemas import JournalEntryOut, JournalIn, JournalUpdate, Page
from ..security import current_user
from ..storage import delete_files
from .common import ensure_writable_plant, entry_out, get_owned

router = APIRouter(prefix="/api/journal", tags=["journal"])


@router.get("", response_model=Page[JournalEntryOut])
def list_entries(
    plant_id: int | None = None,
    kind: str | None = Query(None, pattern="^(observation|photo|analysis|care)$"),
    date_from: date | None = None,
    date_to: date | None = None,
    with_photo: bool = False,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Page[JournalEntryOut]:
    stmt = select(JournalEntry).where(JournalEntry.user_id == user.id)
    if plant_id is not None:
        stmt = stmt.where(JournalEntry.plant_id == plant_id)
    if kind:
        stmt = stmt.where(JournalEntry.kind == kind)
    if date_from:
        stmt = stmt.where(JournalEntry.entry_date >= date_from)
    if date_to:
        stmt = stmt.where(JournalEntry.entry_date <= date_to)
    if with_photo:
        stmt = stmt.where(JournalEntry.photo_id.is_not(None))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.options(
            selectinload(JournalEntry.plant),
            selectinload(JournalEntry.photo),
            selectinload(JournalEntry.analysis),
        )
        .order_by(JournalEntry.entry_date.desc(), JournalEntry.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return Page[JournalEntryOut](
        items=[entry_out(e) for e in rows], total=total, limit=limit, offset=offset
    )


@router.post("", response_model=JournalEntryOut, status_code=status.HTTP_201_CREATED)
def create_entry(
    data: JournalIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> JournalEntryOut:
    plant = get_owned(db, Plant, data.plant_id, user)
    ensure_writable_plant(plant)
    if data.photo_id is not None:
        photo = get_owned(db, Photo, data.photo_id, user)
        if photo.plant_id != plant.id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "That photo belongs to a different plant."
            )
    elif data.kind == "photo":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Please add a photo to this entry."
        )
    if data.kind == "observation" and not (
        data.body.strip() or data.title.strip() or data.photo_id
    ):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Please write a note or add a photo."
        )
    entry = JournalEntry(user_id=user.id, **data.model_dump())
    entry.body = entry.body.strip()
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry_out(entry)


@router.get("/{entry_id}", response_model=JournalEntryOut)
def get_entry(
    entry_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> JournalEntryOut:
    return entry_out(get_owned(db, JournalEntry, entry_id, user))


@router.patch("/{entry_id}", response_model=JournalEntryOut)
def update_entry(
    entry_id: int,
    data: JournalUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> JournalEntryOut:
    entry = get_owned(db, JournalEntry, entry_id, user)
    if entry.is_example:
        raise HTTPException(status.HTTP_409_CONFLICT, "Example entries are read-only.")
    if data.entry_date is not None:
        entry.entry_date = data.entry_date
    if data.title is not None:
        entry.title = data.title.strip()
    if data.body is not None:
        entry.body = data.body.strip()
    db.commit()
    return entry_out(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(
    entry_id: int,
    delete_photo: bool = False,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Delete an entry. With delete_photo=true the attached photo is removed too,
    unless an analysis still uses it."""
    entry = get_owned(db, JournalEntry, entry_id, user)
    if entry.is_example:
        raise HTTPException(status.HTTP_409_CONFLICT, "Example entries are read-only.")
    keys: list[str] = []
    photo = entry.photo
    db.delete(entry)
    if delete_photo and photo is not None:
        used = db.scalar(
            select(func.count()).select_from(Analysis).where(Analysis.photo_id == photo.id)
        )
        if not used:
            keys = [photo.storage_key, photo.thumb_key]
            db.execute(
                update(Plant).where(Plant.cover_photo_id == photo.id).values(cover_photo_id=None)
            )
            db.delete(photo)
    db.commit()
    delete_files(keys)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
