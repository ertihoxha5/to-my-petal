"""Database entities.

Ownership: every user-owned row carries `user_id`. Routers always filter on it, so a
record belonging to someone else is indistinguishable from a missing one (404).

Example records (`is_example=True`) are seeded only on request, are read-only, are
badged in the UI and can be removed in one action. They never mix with real entries:
analyses, new journal entries and reminders cannot be attached to example plants.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, TimestampMixin

LOCALES = ("en", "sq")
MOTION_PREFS = ("system", "reduce", "full")
JOURNAL_KINDS = ("observation", "photo", "analysis", "care")
REMINDER_KINDS = ("water", "wipe_leaves", "rotate_light", "check_light", "mist", "feed", "custom")
ANALYSIS_OUTCOMES = (
    "possible_issue",
    "no_known_issue",
    "inconclusive",
    "unsupported_species",
    "unsupported_image",
    "model_unavailable",
)


def _in(col: str, values: tuple[str, ...]) -> str:
    return f"{col} IN ({', '.join(repr(v) for v in values)})"


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    locale: Mapped[str] = mapped_column(String(5), default="en", nullable=False)
    motion_preference: Mapped[str] = mapped_column(String(10), default="system", nullable=False)
    failed_logins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    sessions: Mapped[list[UserSession]] = relationship(back_populates="user", cascade="all, delete-orphan")
    plants: Mapped[list[Plant]] = relationship(back_populates="user", cascade="all, delete-orphan")
    photos: Mapped[list[Photo]] = relationship(back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(_in("locale", LOCALES), name="locale"),
        CheckConstraint(_in("motion_preference", MOTION_PREFS), name="motion_preference"),
    )


class UserSession(Base):
    """Server-side session. Only a SHA-256 of the random cookie token is stored."""

    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    user_agent: Mapped[str] = mapped_column(String(200), default="", nullable=False)

    user: Mapped[User] = relationship(back_populates="sessions")


class Plant(TimestampMixin, Base):
    __tablename__ = "plants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    nickname: Mapped[str] = mapped_column(String(80), nullable=False)
    species: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    # Normalised key used to decide whether the classifier supports this plant.
    species_key: Mapped[str] = mapped_column(String(32), default="other", nullable=False)
    location: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    acquired_on: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    cover_photo_id: Mapped[int | None] = mapped_column(
        ForeignKey("photos.id", ondelete="SET NULL", use_alter=True, name="fk_plants_cover_photo_id_photos")
    )
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_example: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped[User] = relationship(back_populates="plants")
    photos: Mapped[list[Photo]] = relationship(
        back_populates="plant", cascade="all, delete-orphan", foreign_keys="Photo.plant_id"
    )
    cover_photo: Mapped[Photo | None] = relationship(foreign_keys=[cover_photo_id], post_update=True)
    entries: Mapped[list[JournalEntry]] = relationship(back_populates="plant", cascade="all, delete-orphan")
    analyses: Mapped[list[Analysis]] = relationship(back_populates="plant", cascade="all, delete-orphan")
    reminders: Mapped[list[Reminder]] = relationship(back_populates="plant", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_plants_user_archived", "user_id", "archived_at"),)


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plant_id: Mapped[int | None] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"), index=True)
    # Relative to MEDIA_ROOT; generated server-side, never derived from client input.
    storage_key: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    thumb_key: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    taken_on: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String(300), default="", nullable=False)
    is_example: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped[User] = relationship(back_populates="photos")
    plant: Mapped[Plant | None] = relationship(back_populates="photos", foreign_keys=[plant_id])


class Analysis(TimestampMixin, Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"), nullable=False, index=True)
    photo_id: Mapped[int] = mapped_column(ForeignKey("photos.id", ondelete="CASCADE"), nullable=False)
    outcome: Mapped[str] = mapped_column(String(32), nullable=False)
    model_version: Mapped[str | None] = mapped_column(String(80))
    # Validated AnalysisResult document (see app/inference/schemas.py).
    result: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    # User-reported context, kept separate from model output.
    symptoms_started: Mapped[str | None] = mapped_column(String(20))
    watering: Mapped[str | None] = mapped_column(String(20))
    light: Mapped[str | None] = mapped_column(String(20))
    recent_changes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # Later user input.
    user_correction: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    user_notes: Mapped[str] = mapped_column(Text, default="", nullable=False)

    plant: Mapped[Plant] = relationship(back_populates="analyses")
    photo: Mapped[Photo] = relationship()
    journal_entry: Mapped[JournalEntry | None] = relationship(back_populates="analysis", uselist=False)

    __table_args__ = (CheckConstraint(_in("outcome", ANALYSIS_OUTCOMES), name="outcome"),)


class JournalEntry(TimestampMixin, Base):
    __tablename__ = "journal_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    title: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    photo_id: Mapped[int | None] = mapped_column(ForeignKey("photos.id", ondelete="SET NULL"))
    analysis_id: Mapped[int | None] = mapped_column(
        ForeignKey("analyses.id", ondelete="SET NULL"), unique=True
    )
    care_kind: Mapped[str | None] = mapped_column(String(16))
    is_example: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    plant: Mapped[Plant] = relationship(back_populates="entries")
    photo: Mapped[Photo | None] = relationship()
    analysis: Mapped[Analysis | None] = relationship(back_populates="journal_entry")

    __table_args__ = (
        CheckConstraint(_in("kind", JOURNAL_KINDS), name="kind"),
        Index("ix_journal_user_plant_date", "user_id", "plant_id", "entry_date"),
    )


class Reminder(TimestampMixin, Base):
    __tablename__ = "reminders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plant_id: Mapped[int | None] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    due_on: Mapped[date] = mapped_column(Date, nullable=False)
    repeat_days: Mapped[int | None] = mapped_column(Integer)
    last_completed_on: Mapped[date | None] = mapped_column(Date)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    plant: Mapped[Plant | None] = relationship(back_populates="reminders")

    __table_args__ = (
        CheckConstraint(_in("kind", REMINDER_KINDS), name="kind"),
        CheckConstraint("repeat_days IS NULL OR (repeat_days BETWEEN 1 AND 365)", name="repeat_days"),
        Index("ix_reminders_user_due", "user_id", "active", "due_on"),
    )
