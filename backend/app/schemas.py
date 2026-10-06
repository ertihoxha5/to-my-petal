from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .content.context_notes import Light, SymptomsStarted, Watering
from .inference.schemas import AnalysisResult

SpeciesKey = Literal["tomato", "potato", "pepper_bell", "basil", "monstera", "other"]
ReminderKind = Literal[
    "water", "wipe_leaves", "rotate_light", "check_light", "mist", "feed", "custom"
]
JournalKind = Literal["observation", "photo", "analysis", "care"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


def _strip(v: object) -> object:
    return v.strip() if isinstance(v, str) else v


# ---- Auth ------------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)
    display_name: str = Field(min_length=1, max_length=80)

    _s = field_validator("display_name", mode="before")(_strip)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class UserOut(ORM):
    id: int
    email: str
    display_name: str
    locale: Literal["en", "sq"]
    motion_preference: Literal["system", "reduce", "full"]
    created_at: datetime


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    locale: Literal["en", "sq"] | None = None
    motion_preference: Literal["system", "reduce", "full"] | None = None

    _s = field_validator("display_name", mode="before")(_strip)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=10, max_length=200)


class AccountDelete(BaseModel):
    password: str = Field(min_length=1, max_length=200)


# ---- Photos ------------------------------------------------------------------
class PhotoOut(ORM):
    id: int
    plant_id: int | None
    width: int
    height: int
    taken_on: date
    description: str
    is_example: bool
    created_at: datetime
    url: str = ""
    thumb_url: str = ""


class PhotoUpdate(BaseModel):
    taken_on: date | None = None
    description: str | None = Field(default=None, max_length=300)


# ---- Plants ------------------------------------------------------------------
class PlantIn(BaseModel):
    nickname: str = Field(min_length=1, max_length=80)
    species: str = Field(default="", max_length=120)
    species_key: SpeciesKey = "other"
    location: str = Field(default="", max_length=120)
    acquired_on: date | None = None
    notes: str = Field(default="", max_length=4000)

    _s = field_validator("nickname", "species", "location", mode="before")(_strip)

    @field_validator("acquired_on")
    @classmethod
    def not_future(cls, v: date | None) -> date | None:
        if v and v > date.today():
            raise ValueError("The date can't be in the future.")
        return v


class PlantUpdate(BaseModel):
    nickname: str | None = Field(default=None, min_length=1, max_length=80)
    species: str | None = Field(default=None, max_length=120)
    species_key: SpeciesKey | None = None
    location: str | None = Field(default=None, max_length=120)
    acquired_on: date | None = None
    notes: str | None = Field(default=None, max_length=4000)
    cover_photo_id: int | None = None
    archived: bool | None = None

    _s = field_validator("nickname", "species", "location", mode="before")(_strip)


class PhotoBrief(BaseModel):
    id: int
    taken_on: date
    thumb_url: str
    url: str
    description: str


class PlantOut(ORM):
    id: int
    nickname: str
    species: str
    species_key: SpeciesKey
    location: str
    acquired_on: date | None
    notes: str
    archived_at: datetime | None
    is_example: bool
    created_at: datetime
    updated_at: datetime
    cover: PhotoBrief | None = None
    analysis_supported: bool = False
    entry_count: int = 0
    last_entry_on: date | None = None


class PlantStory(BaseModel):
    plant: PlantOut
    entry_count: int
    latest_entry: JournalEntryOut | None
    recent_photos: list[PhotoBrief]


# ---- Analyses ----------------------------------------------------------------
class AnalysisIn(BaseModel):
    photo_id: int
    symptoms_started: SymptomsStarted | None = None
    watering: Watering | None = None
    light: Light | None = None
    recent_changes: str = Field(default="", max_length=1000)


class AnalysisUpdate(BaseModel):
    user_correction: str | None = Field(default=None, max_length=200)
    user_notes: str | None = Field(default=None, max_length=4000)


class ContextNote(BaseModel):
    text: str
    guide_slug: str | None
    source: Literal["care_guide"]


class AnalysisOut(BaseModel):
    id: int
    plant_id: int
    plant_name: str
    species_key: SpeciesKey
    photo: PhotoBrief
    outcome: str
    model_version: str | None
    result: AnalysisResult
    context: dict[str, Any]
    context_notes: list[ContextNote]
    user_correction: str
    user_notes: str
    journal_entry_id: int | None
    created_at: datetime


class AnalysisBrief(BaseModel):
    id: int
    outcome: str
    headline: str
    condition: str | None


class SaveToJournalIn(BaseModel):
    note: str = Field(default="", max_length=4000)


# ---- Journal -----------------------------------------------------------------
class JournalIn(BaseModel):
    plant_id: int
    kind: Literal["observation", "photo", "care"] = "observation"
    entry_date: date
    title: str = Field(default="", max_length=120)
    body: str = Field(default="", max_length=4000)
    photo_id: int | None = None
    care_kind: ReminderKind | None = None

    _s = field_validator("title", mode="before")(_strip)

    @field_validator("entry_date")
    @classmethod
    def not_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("Journal entries can't be dated in the future.")
        return v


class JournalUpdate(BaseModel):
    entry_date: date | None = None
    title: str | None = Field(default=None, max_length=120)
    body: str | None = Field(default=None, max_length=4000)

    @field_validator("entry_date")
    @classmethod
    def not_future(cls, v: date | None) -> date | None:
        if v and v > date.today():
            raise ValueError("Journal entries can't be dated in the future.")
        return v


class JournalEntryOut(BaseModel):
    id: int
    plant_id: int
    plant_name: str
    kind: JournalKind
    entry_date: date
    title: str
    body: str
    photo: PhotoBrief | None
    analysis: AnalysisBrief | None
    care_kind: str | None
    is_example: bool
    created_at: datetime
    updated_at: datetime


class Page[T](BaseModel):
    items: list[T]
    total: int
    limit: int
    offset: int


# ---- Reminders ---------------------------------------------------------------
class ReminderIn(BaseModel):
    plant_id: int | None = None
    kind: ReminderKind
    title: str = Field(min_length=1, max_length=120)
    notes: str = Field(default="", max_length=1000)
    due_on: date
    repeat_days: int | None = Field(default=None, ge=1, le=365)

    _s = field_validator("title", mode="before")(_strip)


class ReminderUpdate(BaseModel):
    plant_id: int | None = None
    kind: ReminderKind | None = None
    title: str | None = Field(default=None, min_length=1, max_length=120)
    notes: str | None = Field(default=None, max_length=1000)
    due_on: date | None = None
    repeat_days: int | None = Field(default=None, ge=1, le=365)
    clear_repeat: bool = False
    active: bool | None = None


class ReminderComplete(BaseModel):
    completed_on: date | None = None
    log_to_journal: bool = True
    note: str = Field(default="", max_length=1000)


class ReminderOut(ORM):
    id: int
    plant_id: int | None
    plant_name: str | None = None
    kind: ReminderKind
    title: str
    notes: str
    due_on: date
    repeat_days: int | None
    last_completed_on: date | None
    active: bool


# ---- Dashboard ---------------------------------------------------------------
class DashboardOut(BaseModel):
    latest_analysis: AnalysisOut | None
    stories: list[PlantStory]
    reminders: list[ReminderOut]
    plant_count: int
    has_examples: bool
    model: dict[str, Any]


PlantStory.model_rebuild()
