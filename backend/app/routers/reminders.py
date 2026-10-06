from __future__ import annotations

from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..models import JournalEntry, Plant, Reminder, User
from ..schemas import ReminderComplete, ReminderIn, ReminderOut, ReminderUpdate
from ..security import current_user
from .common import ensure_writable_plant, get_owned, reminder_out

router = APIRouter(prefix="/api/reminders", tags=["reminders"])

CARE_TITLES = {
    "water": "Watered",
    "wipe_leaves": "Wiped leaves",
    "rotate_light": "Rotated for light",
    "check_light": "Checked the light",
    "mist": "Misted",
    "feed": "Fed",
    "custom": "Care",
}


def _plant_for(db: Session, plant_id: int | None, user: User) -> Plant | None:
    if plant_id is None:
        return None
    plant = get_owned(db, Plant, plant_id, user)
    ensure_writable_plant(plant)
    return plant


@router.get("", response_model=list[ReminderOut])
def list_reminders(
    state: Literal["active", "all"] = "active",
    plant_id: int | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[ReminderOut]:
    stmt = select(Reminder).where(Reminder.user_id == user.id).options(selectinload(Reminder.plant))
    if state == "active":
        stmt = stmt.where(Reminder.active.is_(True))
    if plant_id is not None:
        stmt = stmt.where(Reminder.plant_id == plant_id)
    return [reminder_out(r) for r in db.scalars(stmt.order_by(Reminder.due_on, Reminder.id))]


@router.post("", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
def create_reminder(
    data: ReminderIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> ReminderOut:
    _plant_for(db, data.plant_id, user)
    reminder = Reminder(user_id=user.id, **data.model_dump())
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder_out(reminder)


@router.patch("/{reminder_id}", response_model=ReminderOut)
def update_reminder(
    reminder_id: int,
    data: ReminderUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> ReminderOut:
    reminder = get_owned(db, Reminder, reminder_id, user)
    changes = data.model_dump(exclude_unset=True)
    if "plant_id" in changes:
        _plant_for(db, changes["plant_id"], user)
        reminder.plant_id = changes["plant_id"]
    for k in ("kind", "title", "notes", "due_on", "active"):
        if changes.get(k) is not None:
            setattr(reminder, k, changes[k].strip() if isinstance(changes[k], str) else changes[k])
    if data.clear_repeat:
        reminder.repeat_days = None
    elif changes.get("repeat_days") is not None:
        reminder.repeat_days = changes["repeat_days"]
    db.commit()
    db.refresh(reminder)
    return reminder_out(reminder)


@router.post("/{reminder_id}/complete", response_model=ReminderOut)
def complete_reminder(
    reminder_id: int,
    data: ReminderComplete,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> ReminderOut:
    reminder = get_owned(db, Reminder, reminder_id, user)
    if not reminder.active:
        raise HTTPException(status.HTTP_409_CONFLICT, "This reminder is already done.")
    done_on = data.completed_on or date.today()
    if done_on > date.today():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Completion date can't be in the future."
        )
    reminder.last_completed_on = done_on
    if reminder.repeat_days:
        reminder.due_on = done_on + timedelta(days=reminder.repeat_days)
    else:
        reminder.active = False
    if data.log_to_journal and reminder.plant is not None and not reminder.plant.is_example:
        db.add(
            JournalEntry(
                user_id=user.id,
                plant_id=reminder.plant_id,
                kind="care",
                entry_date=done_on,
                title=CARE_TITLES.get(reminder.kind, "Care")
                if reminder.kind != "custom"
                else reminder.title,
                body=data.note.strip(),
                care_kind=reminder.kind,
            )
        )
    db.commit()
    db.refresh(reminder)
    return reminder_out(reminder)


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(
    reminder_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> Response:
    db.delete(get_owned(db, Reminder, reminder_id, user))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
