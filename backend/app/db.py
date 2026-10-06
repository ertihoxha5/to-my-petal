from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime

from sqlalchemy import DateTime, MetaData, create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from .config import get_settings

NAMING = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


def make_engine(url: str) -> Engine:
    kwargs: dict = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    engine = create_engine(url, **kwargs)
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_conn, _record):  # pragma: no cover - trivial
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute("PRAGMA journal_mode=WAL")
            cur.close()

    return engine


_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


def configure(url: str | None = None) -> None:
    global _engine, _SessionLocal
    url = url or get_settings().database_url
    if url.startswith("sqlite:///"):
        from pathlib import Path

        Path(url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)
    _engine = make_engine(url)
    _SessionLocal = sessionmaker(bind=_engine, expire_on_commit=False)


def get_engine() -> Engine:
    if _engine is None:
        configure()
    assert _engine is not None
    return _engine


def get_db() -> Iterator[Session]:
    if _SessionLocal is None:
        configure()
    assert _SessionLocal is not None
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()
