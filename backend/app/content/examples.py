"""Optional example garden.

Seeded only when a user asks for it. Every row is flagged `is_example`, shown with an
"Example" badge, read-only, and removable in one action. Examples deliberately contain
no analyses, so no prediction is ever shown that the model did not make. Photos are
public Commons images (see docs/ASSETS.md); within one plant they show different
leaves, not one plant over time.
"""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import utcnow
from ..models import JournalEntry, Photo, Plant, User
from ..storage import copy_example_image, delete_files

PHOTO_DIR = Path(__file__).parent / "example_photos"

EXAMPLES: list[dict[str, Any]] = [
    {
        "plant": {
            "nickname": "Tomato",
            "species": "Tomato (Solanum lycopersicum)",
            "species_key": "tomato",
            "location": "Sunny balcony",
            "notes": "An example plant to show how a journal grows.",
        },
        "cover": ("example-tomato-cover.jpg", 14, "Ripening tomatoes with raindrops"),
        "entries": [
            (
                "example-tomato-leaf-1.jpg",
                7,
                "Spots on lower leaves",
                "Small round spots with pale centres on a few lower leaves. Removed the worst ones.",
                "Tomato leaflets with many small, pale-centred spots",
            ),
            (
                "example-tomato-leaf-2.jpg",
                0,
                "Checked again",
                "Some new spots appeared. Watering at the soil now instead of over the leaves.",
                "Close-up of a tomato leaf with brown spots and yellowing",
            ),
        ],
    },
    {
        "plant": {
            "nickname": "Basil",
            "species": "Sweet basil (Ocimum basilicum)",
            "species_key": "basil",
            "location": "Kitchen window",
            "notes": "Journal only: the image model doesn't cover basil.",
        },
        "cover": ("example-basil-cover.jpg", 12, "A bed of bright green basil"),
        "entries": [
            (
                "example-basil-1.jpg",
                9,
                "Pinched the flower buds",
                "Plenty of new leaves this week.",
                "Basil stems with broad glossy leaves",
            ),
            (
                "example-basil-2.jpg",
                2,
                "Looking full",
                "New leaves look healthy and vibrant.",
                "Basil plant with large green leaves",
            ),
        ],
    },
    {
        "plant": {
            "nickname": "Monstera",
            "species": "Monstera deliciosa",
            "species_key": "monstera",
            "location": "Living room",
            "notes": "Journal only: the image model doesn't cover Monstera.",
        },
        "cover": ("example-monstera-cover.jpg", 11, "A Monstera leaf with its typical holes"),
        "entries": [
            (
                "example-monstera-1.jpg",
                10,
                "Moved closer to the window",
                "Bright, indirect light now.",
                "A large split Monstera leaf",
            ),
            (
                "example-monstera-2.jpg",
                1,
                "Noticed less yellowing",
                "Fewer yellow leaves after the move.",
                "Monstera leaves growing outdoors",
            ),
        ],
    },
]


def _photo(db: Session, user: User, plant: Plant, name: str, days_ago: int, desc: str) -> Photo:
    stored = copy_example_image(user.id, PHOTO_DIR / name)
    photo = Photo(
        user_id=user.id,
        plant_id=plant.id,
        storage_key=stored.storage_key,
        thumb_key=stored.thumb_key,
        width=stored.width,
        height=stored.height,
        size_bytes=stored.size_bytes,
        taken_on=date.today() - timedelta(days=days_ago),
        description=desc,
        is_example=True,
        created_at=utcnow(),
    )
    db.add(photo)
    db.flush()
    return photo


def seed_examples(db: Session, user: User) -> int:
    existing = db.scalar(
        select(Plant.id).where(Plant.user_id == user.id, Plant.is_example.is_(True)).limit(1)
    )
    if existing:
        return 0
    created = 0
    for ex in EXAMPLES:
        plant = Plant(user_id=user.id, is_example=True, **ex["plant"])
        db.add(plant)
        db.flush()
        cover = _photo(db, user, plant, *ex["cover"])
        plant.cover_photo_id = cover.id
        for fname, days_ago, title, body, desc in ex["entries"]:
            photo = _photo(db, user, plant, fname, days_ago, desc)
            db.add(
                JournalEntry(
                    user_id=user.id,
                    plant_id=plant.id,
                    kind="photo",
                    entry_date=photo.taken_on,
                    title=title,
                    body=body,
                    photo_id=photo.id,
                    is_example=True,
                )
            )
        created += 1
    db.commit()
    return created


def remove_examples(db: Session, user: User) -> None:
    plants = list(
        db.scalars(select(Plant).where(Plant.user_id == user.id, Plant.is_example.is_(True)))
    )
    keys = [k for p in plants for ph in p.photos for k in (ph.storage_key, ph.thumb_key)]
    for p in plants:
        p.cover_photo_id = None
    db.flush()
    for p in plants:
        db.delete(p)
    db.commit()
    delete_files(keys)
