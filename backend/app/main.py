from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .inference.service import inference_service
from .routers import account, analyses, auth, dashboard, guide, journal, photos, plants, reminders
from .security import CSRF_HEADER, csrf_ok

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    if not app.state.skip_model_load:
        inference_service.load(settings.model_dir, settings.torch_threads)
    yield


def create_app(skip_model_load: bool = False) -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="to my petal API",
        version="0.1.0",
        description="Plant collection, visual journal, care reminders and honest leaf-image analysis.",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )
    app.state.skip_model_load = skip_model_load

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type", CSRF_HEADER],
        max_age=600,
    )

    @app.middleware("http")
    async def guard(request: Request, call_next) -> Response:  # type: ignore[no-untyped-def]
        if request.url.path.startswith("/api/") and not csrf_ok(request):
            return JSONResponse(
                {"detail": "Missing request header. Please reload the page."}, status_code=403
            )
        response: Response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "same-origin")
        response.headers.setdefault("X-Frame-Options", "DENY")
        if request.url.path.startswith("/api/") and "Cache-Control" not in response.headers:
            response.headers["Cache-Control"] = "no-store"
        return response

    for r in (auth, plants, photos, analyses, journal, reminders, account, dashboard, guide):
        app.include_router(r.router)

    dist = settings.frontend_dist
    if dist and (dist / "index.html").is_file():
        _mount_frontend(app, dist)
    return app


def _mount_frontend(app: FastAPI, dist: Path) -> None:
    """Serve the built frontend from the same origin (simplest secure deployment)."""
    app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")
    root = dist.resolve()

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path.startswith("api/"):
            return JSONResponse({"detail": "Not found"}, status_code=404)  # type: ignore[return-value]
        candidate = (root / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(root):
            headers = (
                {"Cache-Control": "no-cache"}
                if candidate.name in ("sw.js", "manifest.webmanifest")
                else {}
            )
            return FileResponse(candidate, headers=headers)
        return FileResponse(root / "index.html", headers={"Cache-Control": "no-cache"})


app = create_app()
