from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..inference.service import inference_service
from ..models import Analysis, JournalEntry, Photo, Plant, Reminder, User
from ..schemas import DashboardOut, PlantStory
from ..security import current_user
from .common import analysis_out, entry_out, entry_stats, photo_brief, plant_out, reminder_out

router = APIRouter(prefix="/api", tags=["dashboard"])


def model_status() -> dict:
    info = inference_service.info()
    meta = inference_service.metadata
    metrics = inference_service.metrics
    return {
        **info.model_dump(),
        "supported_species": ["tomato", "potato", "pepper_bell"],
        "classes": meta.classes if meta else [],
        "evaluation": {
            k: {
                kk: metrics[k].get(kk)
                for kk in (
                    "description",
                    "images",
                    "accuracy",
                    "macro_f1",
                    "abstention",
                    "flagged_unfamiliar_fraction",
                    "would_show_finding_fraction",
                    "source",
                )
                if kk in metrics[k]
            }
            for k in ("controlled_test", "near_ood", "real_world")
            if isinstance(metrics.get(k), dict)
        },
    }


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)) -> DashboardOut:
    latest = db.scalar(
        select(Analysis)
        .where(Analysis.user_id == user.id)
        .order_by(Analysis.created_at.desc(), Analysis.id.desc())
    )
    plants = list(
        db.scalars(
            select(Plant)
            .where(Plant.user_id == user.id, Plant.archived_at.is_(None))
            .options(selectinload(Plant.cover_photo))
        )
    )
    stats = entry_stats(db, [p.id for p in plants])
    # The user's own plants always come before examples, then most recent activity first.
    plants.sort(
        key=lambda p: (
            not p.is_example,
            str(stats.get(p.id, (0, ""))[1] or ""),
            p.updated_at.isoformat(),
        ),
        reverse=True,
    )
    stories = []
    for p in plants[:3]:
        last = db.scalar(
            select(JournalEntry)
            .where(JournalEntry.plant_id == p.id)
            .order_by(JournalEntry.entry_date.desc(), JournalEntry.id.desc())
        )
        photos = list(
            db.scalars(
                select(Photo)
                .where(Photo.plant_id == p.id, Photo.id != (p.cover_photo_id or 0))
                .order_by(Photo.taken_on.desc(), Photo.id.desc())
                .limit(2)
            )
        )
        photos.reverse()  # older first, newer second
        stories.append(
            PlantStory(
                plant=plant_out(p, stats),
                entry_count=stats.get(p.id, (0, None))[0],
                latest_entry=entry_out(last) if last else None,
                recent_photos=[b for b in (photo_brief(ph) for ph in photos) if b],
            )
        )
    reminders = list(
        db.scalars(
            select(Reminder)
            .where(Reminder.user_id == user.id, Reminder.active.is_(True))
            .options(selectinload(Reminder.plant))
            .order_by(Reminder.due_on, Reminder.id)
            .limit(6)
        )
    )
    return DashboardOut(
        latest_analysis=analysis_out(latest) if latest else None,
        stories=stories,
        reminders=[reminder_out(r) for r in reminders],
        plant_count=sum(1 for p in plants if not p.is_example),
        has_examples=any(p.is_example for p in plants),
        model=model_status(),
    )
