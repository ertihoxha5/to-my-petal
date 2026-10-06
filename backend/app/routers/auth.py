from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import LoginIn, RegisterIn, UserOut
from ..security import (
    clear_session_cookie,
    create_session,
    current_user,
    destroy_session,
    hash_password,
    is_locked,
    needs_rehash,
    register_failed_login,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

BAD_LOGIN = "That email and password don't match. Please try again."


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(
    data: RegisterIn, request: Request, response: Response, db: Session = Depends(get_db)
) -> User:
    email = data.email.lower()
    if db.scalar(select(func.count()).select_from(User).where(User.email == email)):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "An account with this email already exists. Try signing in."
        )
    user = User(
        email=email, password_hash=hash_password(data.password), display_name=data.display_name
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "An account with this email already exists."
        ) from exc
    create_session(db, user, response, request.headers.get("user-agent", ""))
    return user


@router.post("/login", response_model=UserOut)
def login(
    data: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)
) -> User:
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if user is not None and is_locked(user):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many sign-in attempts. Please wait a few minutes and try again.",
        )
    if not verify_password(user.password_hash if user else None, data.password) or user is None:
        if user is not None:
            register_failed_login(db, user)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, BAD_LOGIN)
    user.failed_logins = 0
    user.locked_until = None
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(data.password)
    db.commit()
    create_session(db, user, response, request.headers.get("user-agent", ""))
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> Response:
    destroy_session(db, request)
    clear_session_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> User:
    return user
