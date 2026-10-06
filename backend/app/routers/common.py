"""Ownership-checked lookups and response builders shared by routers."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..content.context_notes import context_notes
from ..inference.labels import SUPPORTED_SPECIES
from ..inference.schemas import AnalysisResult
from ..models import Analysis, JournalEntry, Photo, Plant, Reminder, User
from ..schemas import (
    AnalysisBrief,
    AnalysisOut,
    ContextNote,
    JournalEntryOut,
    PhotoBrief,
    PhotoOut,
    PlantOut,
    ReminderOut,
)

NOT_FOUND = {
    Plant: "plant",
    Photo: "photo",
    Analysis: "analysis",
    JournalEntry: "journal entry",
    Reminder: "reminder",
}
EXAMPLE_READ_ONLY = (
    "Example plants are read-only so they stay separate from your own records. "
    "Add your own plant to keep a journal."
)


def get_owned[T: (Plant, Photo, Analysis, JournalEntry, Reminder)](
    db: Session, model: type[T], obj_id: int, user: User
) -> T:
    """Fetch a row owned by `user`; anything else is a 404 (no ownership leaks)."""
    obj = db.get(model, obj_id)
    if obj is None or obj.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"We couldn't find that {NOT_FOUND[model]}.")
    return obj


def ensure_writable_plant(plant: Plant) -> None:
    if plant.is_example:
        raise HTTPException(status.HTTP_409_CONFLICT, EXAMPLE_READ_ONLY)


def photo_urls(photo_id: int) -> tuple[str, str]:
    return f"/api/photos/{photo_id}/file", f"/api/photos/{photo_id}/file?variant=thumb"


def photo_brief(p: Photo | None) -> PhotoBrief | None:
    if p is None:
        return None
    url, thumb = photo_urls(p.id)
    return PhotoBrief(
        id=p.id, taken_on=p.taken_on, url=url, thumb_url=thumb, description=p.description
    )


def photo_out(p: Photo) -> PhotoOut:
    url, thumb = photo_urls(p.id)
    out = PhotoOut.model_validate(p)
    out.url, out.thumb_url = url, thumb
    return out


def entry_stats(db: Session, plant_ids: list[int]) -> dict[int, tuple[int, object]]:
    if not plant_ids:
        return {}
    rows = db.execute(
        select(
            JournalEntry.plant_id, func.count(JournalEntry.id), func.max(JournalEntry.entry_date)
        )
        .where(JournalEntry.plant_id.in_(plant_ids))
        .group_by(JournalEntry.plant_id)
    ).all()
    return {pid: (n, last) for pid, n, last in rows}


def plant_out(p: Plant, stats: dict[int, tuple[int, object]] | None = None) -> PlantOut:
    out = PlantOut.model_validate(p)
    out.cover = photo_brief(p.cover_photo)
    out.analysis_supported = p.species_key in SUPPORTED_SPECIES
    if stats is not None and p.id in stats:
        out.entry_count, last = stats[p.id]
        out.last_entry_on = last  # type: ignore[assignment]
    return out


def analysis_brief(a: Analysis | None) -> AnalysisBrief | None:
    if a is None:
        return None
    primary = (a.result or {}).get("primary") or {}
    return AnalysisBrief(
        id=a.id,
        outcome=a.outcome,
        headline=(a.result or {}).get("headline", ""),
        condition=primary.get("condition"),
    )


def entry_out(e: JournalEntry) -> JournalEntryOut:
    return JournalEntryOut(
        id=e.id,
        plant_id=e.plant_id,
        plant_name=e.plant.nickname,
        kind=e.kind,  # type: ignore[arg-type]
        entry_date=e.entry_date,
        title=e.title,
        body=e.body,
        photo=photo_brief(e.photo),
        analysis=analysis_brief(e.analysis),
        care_kind=e.care_kind,
        is_example=e.is_example,
        created_at=e.created_at,
        updated_at=e.updated_at,
    )


def analysis_out(a: Analysis) -> AnalysisOut:
    brief = photo_brief(a.photo)
    assert brief is not None
    notes = context_notes(
        a.plant.species_key, a.symptoms_started, a.watering, a.light, a.recent_changes
    )
    return AnalysisOut(
        id=a.id,
        plant_id=a.plant_id,
        plant_name=a.plant.nickname,
        species_key=a.plant.species_key,  # type: ignore[arg-type]
        photo=brief,
        outcome=a.outcome,
        model_version=a.model_version,
        result=AnalysisResult.model_validate(a.result),
        context={
            "symptoms_started": a.symptoms_started,
            "watering": a.watering,
            "light": a.light,
            "recent_changes": a.recent_changes,
        },
        context_notes=[ContextNote.model_validate(n) for n in notes],
        user_correction=a.user_correction,
        user_notes=a.user_notes,
        journal_entry_id=a.journal_entry.id if a.journal_entry else None,
        created_at=a.created_at,
    )


def reminder_out(r: Reminder) -> ReminderOut:
    out = ReminderOut.model_validate(r)
    out.plant_name = r.plant.nickname if r.plant else None
    return out
