"""Analysis requests.

Processing strategy: inference runs inside the request (in FastAPI's worker thread
pool) and the validated result is written to the database before responding. No job
state lives in process memory, so any number of API workers can serve requests; the
cost is that each worker process holds its own copy of the model (about 20 MB of
weights plus PyTorch) and a request takes as long as one CPU forward pass.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..inference import decision
from ..inference.labels import SUPPORTED_SPECIES
from ..inference.schemas import AnalysisResult
from ..inference.service import inference_service
from ..models import Analysis, JournalEntry, Photo, Plant, User
from ..schemas import (
    AnalysisIn,
    AnalysisOut,
    AnalysisUpdate,
    JournalEntryOut,
    Page,
    SaveToJournalIn,
)
from ..security import current_user
from ..storage import safe_path
from .common import analysis_out, ensure_writable_plant, entry_out, get_owned

router = APIRouter(prefix="/api/analyses", tags=["analyses"])
log = logging.getLogger(__name__)


def run_analysis(plant: Plant, photo: Photo) -> AnalysisResult:
    """Produce a validated result for this photo. Never raises for model problems:
    those become an honest `model_unavailable` result."""
    model = inference_service.info()
    if plant.species_key not in SUPPORTED_SPECIES:
        return decision.unsupported_species(plant.species_key, plant.nickname, model)
    if not inference_service.available:
        return decision.model_unavailable(model)
    from PIL import Image

    with Image.open(safe_path(photo.storage_key)) as im:
        img = im.convert("RGB")
    quality = decision.assess_quality(img)
    try:
        logits = inference_service.logits(img)
        assert inference_service.metadata is not None
        return decision.decide(
            logits=logits,
            classes=inference_service.metadata.classes,
            thresholds=inference_service.thresholds(),
            species_key=plant.species_key,
            quality=quality,
            model=model,
        )
    except (RuntimeError, ValueError, ValidationError) as exc:
        log.exception("Inference failed: %s", exc)
        info = model.model_copy(
            update={"available": False, "unavailable_reason": "The analysis failed to run."}
        )
        return decision.model_unavailable(info)


@router.post("", response_model=AnalysisOut, status_code=status.HTTP_201_CREATED)
def create_analysis(
    data: AnalysisIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> AnalysisOut:
    photo = get_owned(db, Photo, data.photo_id, user)
    if photo.plant_id is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Please choose a plant for this photo first."
        )
    plant = get_owned(db, Plant, photo.plant_id, user)
    ensure_writable_plant(plant)
    result = run_analysis(plant, photo)
    analysis = Analysis(
        user_id=user.id,
        plant_id=plant.id,
        photo_id=photo.id,
        outcome=result.outcome,
        model_version=result.model.version,
        result=result.model_dump(mode="json"),
        symptoms_started=data.symptoms_started,
        watering=data.watering,
        light=data.light,
        recent_changes=data.recent_changes.strip(),
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis_out(analysis)


@router.post("/{analysis_id}/rerun", response_model=AnalysisOut)
def rerun_analysis(
    analysis_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> AnalysisOut:
    analysis = get_owned(db, Analysis, analysis_id, user)
    ensure_writable_plant(analysis.plant)
    result = run_analysis(analysis.plant, analysis.photo)
    analysis.outcome = result.outcome
    analysis.model_version = result.model.version
    analysis.result = result.model_dump(mode="json")
    db.commit()
    return analysis_out(analysis)


@router.get("", response_model=Page[AnalysisOut])
def list_analyses(
    plant_id: int | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Page[AnalysisOut]:
    stmt = select(Analysis).where(Analysis.user_id == user.id)
    if plant_id is not None:
        stmt = stmt.where(Analysis.plant_id == plant_id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.order_by(Analysis.created_at.desc(), Analysis.id.desc()).limit(limit).offset(offset)
    )
    return Page[AnalysisOut](
        items=[analysis_out(a) for a in rows], total=total, limit=limit, offset=offset
    )


@router.get("/{analysis_id}", response_model=AnalysisOut)
def get_analysis(
    analysis_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> AnalysisOut:
    return analysis_out(get_owned(db, Analysis, analysis_id, user))


@router.patch("/{analysis_id}", response_model=AnalysisOut)
def update_analysis(
    analysis_id: int,
    data: AnalysisUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> AnalysisOut:
    analysis = get_owned(db, Analysis, analysis_id, user)
    ensure_writable_plant(analysis.plant)
    if data.user_correction is not None:
        analysis.user_correction = data.user_correction.strip()
    if data.user_notes is not None:
        analysis.user_notes = data.user_notes.strip()
    db.commit()
    return analysis_out(analysis)


@router.post("/{analysis_id}/journal", response_model=JournalEntryOut)
def save_to_journal(
    analysis_id: int,
    data: SaveToJournalIn,
    response: Response,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> JournalEntryOut:
    analysis = get_owned(db, Analysis, analysis_id, user)
    ensure_writable_plant(analysis.plant)
    entry = analysis.journal_entry
    if entry is None:
        entry = JournalEntry(
            user_id=user.id,
            plant_id=analysis.plant_id,
            kind="analysis",
            entry_date=analysis.photo.taken_on,
            title=analysis.result.get("headline", "")[:120],
            body=data.note.strip(),
            photo_id=analysis.photo_id,
            analysis_id=analysis.id,
        )
        db.add(entry)
        response.status_code = status.HTTP_201_CREATED
    elif data.note.strip():
        entry.body = data.note.strip()
    db.commit()
    db.refresh(entry)
    return entry_out(entry)


@router.delete("/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_analysis(
    analysis_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> Response:
    analysis = get_owned(db, Analysis, analysis_id, user)
    ensure_writable_plant(analysis.plant)
    db.delete(analysis)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
