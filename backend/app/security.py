"""Password hashing, server-side sessions and request guards."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db, utcnow
from .models import User, UserSession

_hasher = PasswordHasher()  # argon2id with the library's maintained defaults
# Verified against when the e-mail is unknown so both paths take similar time.
_DUMMY_HASH = _hasher.hash("not-a-real-password-" + secrets.token_hex(8))

CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "to-my-petal"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _aware(dt: datetime) -> datetime:
    # SQLite returns naive datetimes; values are always written in UTC.
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def create_session(db: Session, user: User, response: Response, user_agent: str = "") -> None:
    settings = get_settings()
    token = secrets.token_urlsafe(32)
    now = utcnow()
    db.add(
        UserSession(
            user_id=user.id,
            token_hash=_token_hash(token),
            created_at=now,
            last_seen_at=now,
            expires_at=now + timedelta(days=settings.session_days),
            user_agent=user_agent[:200],
        )
    )
    db.commit()
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=settings.session_days * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,  # type: ignore[arg-type]
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    s = get_settings()
    response.delete_cookie(s.session_cookie_name, path="/", secure=s.cookie_secure, httponly=True,
                           samesite=s.cookie_samesite)  # type: ignore[arg-type]


def destroy_session(db: Session, request: Request) -> None:
    token = request.cookies.get(get_settings().session_cookie_name)
    if token:
        db.execute(delete(UserSession).where(UserSession.token_hash == _token_hash(token)))
        db.commit()


def destroy_all_sessions(db: Session, user_id: int, except_request: Request | None = None) -> None:
    keep = None
    if except_request is not None:
        token = except_request.cookies.get(get_settings().session_cookie_name)
        keep = _token_hash(token) if token else None
    stmt = delete(UserSession).where(UserSession.user_id == user_id)
    if keep:
        stmt = stmt.where(UserSession.token_hash != keep)
    db.execute(stmt)
    db.commit()


def optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    token = request.cookies.get(get_settings().session_cookie_name)
    if not token:
        return None
    sess = db.scalar(select(UserSession).where(UserSession.token_hash == _token_hash(token)))
    if sess is None:
        return None
    now = utcnow()
    if _aware(sess.expires_at) <= now:
        db.delete(sess)
        db.commit()
        return None
    if now - _aware(sess.last_seen_at) > timedelta(minutes=5):
        sess.last_seen_at = now
        db.commit()
    return sess.user


def current_user(user: User | None = Depends(optional_user)) -> User:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in to continue.")
    return user


def is_locked(user: User) -> bool:
    return user.locked_until is not None and _aware(user.locked_until) > utcnow()


def register_failed_login(db: Session, user: User) -> None:
    s = get_settings()
    user.failed_logins += 1
    if user.failed_logins >= s.login_max_failures:
        user.locked_until = utcnow() + timedelta(minutes=s.login_lock_minutes)
        user.failed_logins = 0
    db.commit()


def csrf_ok(request: Request) -> bool:
    """State-changing requests must carry a custom header.

    Browsers cannot attach custom headers to cross-site requests without a CORS
    preflight, and CORS only admits the configured origins, so a forged form post
    from another site is rejected. The session cookie is also SameSite=Lax.
    """
    if request.method in SAFE_METHODS:
        return True
    return request.headers.get(CSRF_HEADER) == CSRF_VALUE
