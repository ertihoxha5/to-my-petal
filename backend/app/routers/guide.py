from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status

from ..content.care_guide import BY_SLUG, TREATMENT_NOTE, search
from .dashboard import model_status

router = APIRouter(prefix="/api", tags=["guide", "system"])


@router.get("/guide")
def list_guide(
    q: str = Query("", max_length=80),
    plant: str | None = None,
    kind: Literal["plant", "condition"] | None = None,
) -> dict:
    """Public: curated guidance does not depend on an account."""
    return {
        "articles": [a.as_dict() for a in search(q, plant, kind)],
        "treatment_note": TREATMENT_NOTE,
    }


@router.get("/guide/{slug}")
def get_article(slug: str) -> dict:
    article = BY_SLUG.get(slug)
    if article is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "We couldn't find that guide.")
    return article.as_dict()


@router.get("/system/model")
def model_info() -> dict:
    return model_status()


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}
