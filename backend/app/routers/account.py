from __future__ import annotations

import json
import tempfile
import zipfile
from collections.abc import Iterator
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..content.examples import remove_examples, seed_examples
from ..db import get_db
from ..models import Analysis, JournalEntry, Photo, Plant, Reminder, User
from ..schemas import AccountDelete, PasswordChange, UserOut, UserUpdate
from ..security import (
    clear_session_cookie,
    current_user,
    destroy_all_sessions,
    hash_password,
    verify_password,
)
from ..storage import delete_user_dir, safe_path

router = APIRouter(prefix="/api/account", tags=["account"])


@router.patch("", response_model=UserOut)
def update_account(
    data: UserUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> User:
    for k, v in data.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(user, k, v)
    db.commit()
    return user


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    data: PasswordChange,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Response:
    if not verify_password(user.password_hash, data.current_password):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your current password isn't right.")
    user.password_hash = hash_password(data.new_password)
    db.commit()
    destroy_all_sessions(db, user.id, except_request=request)  # sign out other devices
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _iso(v: object) -> object:
    return v.isoformat() if hasattr(v, "isoformat") else v


def _row(obj: object, fields: list[str]) -> dict:
    return {f: _iso(getattr(obj, f)) for f in fields}


@router.get("/export")
def export_data(
    user: User = Depends(current_user), db: Session = Depends(get_db)
) -> StreamingResponse:
    """A ZIP with data.json and every photo at full stored resolution."""
    uid = user.id
    plants = list(db.scalars(select(Plant).where(Plant.user_id == uid)))
    photos = list(db.scalars(select(Photo).where(Photo.user_id == uid)))
    data = {
        "format": "to-my-petal-export/1",
        "exported_at": datetime.now(UTC).isoformat(),
        "account": _row(
            user, ["email", "display_name", "locale", "motion_preference", "created_at"]
        ),
        "plants": [
            _row(
                p,
                [
                    "id",
                    "nickname",
                    "species",
                    "species_key",
                    "location",
                    "acquired_on",
                    "notes",
                    "cover_photo_id",
                    "archived_at",
                    "is_example",
                    "created_at",
                ],
            )
            for p in plants
        ],
        "photos": [
            {
                **_row(
                    p,
                    [
                        "id",
                        "plant_id",
                        "taken_on",
                        "description",
                        "width",
                        "height",
                        "is_example",
                        "created_at",
                    ],
                ),
                "file": f"photos/{p.id}.jpg",
            }
            for p in photos
        ],
        "analyses": [
            _row(
                a,
                [
                    "id",
                    "plant_id",
                    "photo_id",
                    "outcome",
                    "model_version",
                    "result",
                    "symptoms_started",
                    "watering",
                    "light",
                    "recent_changes",
                    "user_correction",
                    "user_notes",
                    "created_at",
                ],
            )
            for a in db.scalars(select(Analysis).where(Analysis.user_id == uid))
        ],
        "journal": [
            _row(
                e,
                [
                    "id",
                    "plant_id",
                    "kind",
                    "entry_date",
                    "title",
                    "body",
                    "photo_id",
                    "analysis_id",
                    "care_kind",
                    "is_example",
                    "created_at",
                ],
            )
            for e in db.scalars(select(JournalEntry).where(JournalEntry.user_id == uid))
        ],
        "reminders": [
            _row(
                r,
                [
                    "id",
                    "plant_id",
                    "kind",
                    "title",
                    "notes",
                    "due_on",
                    "repeat_days",
                    "last_completed_on",
                    "active",
                ],
            )
            for r in db.scalars(select(Reminder).where(Reminder.user_id == uid))
        ],
    }
    tmp = tempfile.SpooledTemporaryFile(max_size=32 * 1024 * 1024)  # noqa: SIM115 - closed by the generator
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("data.json", json.dumps(data, indent=2, ensure_ascii=False))
        zf.writestr(
            "README.txt",
            "Your to my petal export. data.json holds your records; photos/ holds your photos.\n",
        )
        for p in photos:
            path = safe_path(p.storage_key)
            if path.is_file():
                zf.write(path, f"photos/{p.id}.jpg", compress_type=zipfile.ZIP_STORED)
    tmp.seek(0)

    def stream() -> Iterator[bytes]:
        try:
            while chunk := tmp.read(1024 * 256):
                yield chunk
        finally:
            tmp.close()

    name = f"to-my-petal-export-{datetime.now(UTC):%Y%m%d}.zip"
    return StreamingResponse(
        stream(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{name}"',
            "Cache-Control": "no-store",
        },
    )


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    data: AccountDelete,
    response: Response,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Response:
    if not verify_password(user.password_hash, data.password):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your password isn't right.")
    uid = user.id
    for plant in db.scalars(select(Plant).where(Plant.user_id == uid)):
        plant.cover_photo_id = None
    db.flush()
    db.delete(user)
    db.commit()
    delete_user_dir(uid)
    clear_session_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/examples", status_code=status.HTTP_201_CREATED)
def add_examples(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    created = seed_examples(db, user)
    return {"created_plants": created}


@router.delete("/examples", status_code=status.HTTP_204_NO_CONTENT)
def delete_examples(user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    remove_examples(db, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
