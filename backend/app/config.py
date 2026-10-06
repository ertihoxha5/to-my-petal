from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Runtime configuration. Every value can be set with a TMP_ environment variable
    (for example TMP_DATABASE_URL) or in backend/.env."""

    model_config = SettingsConfigDict(env_prefix="TMP_", env_file=BACKEND_DIR / ".env", extra="ignore")

    environment: str = "development"
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'var' / 'tomypetal.db').as_posix()}"
    media_root: Path = BACKEND_DIR / "var" / "media"
    model_dir: Path = BACKEND_DIR / "models" / "current"

    # Comma-separated list of browser origins allowed to call the API with credentials.
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"])

    session_cookie_name: str = "tmp_session"
    session_days: int = 30
    cookie_secure: bool = False  # set to true behind HTTPS
    cookie_samesite: str = "lax"

    max_upload_mb: float = 12.0
    min_image_side: int = 128
    max_image_side: int = 12_000
    max_image_pixels: int = 50_000_000
    stored_max_side: int = 2048
    thumb_max_side: int = 640

    login_max_failures: int = 5
    login_lock_minutes: int = 10

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, v: object) -> object:
        if isinstance(v, str) and not v.strip().startswith("["):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @property
    def max_upload_bytes(self) -> int:
        return int(self.max_upload_mb * 1024 * 1024)


@lru_cache
def get_settings() -> Settings:
    return Settings()
