# Deployment guide

## Recommended shape: one origin

Build the frontend and let the API serve it. Cookies then stay first-party, CORS isn't needed,
and the service worker scope is simple.

```bash
cd frontend && npm ci && npm run build            # -> frontend/dist
cd ../backend && uv sync --frozen --extra inference
export TMP_FRONTEND_DIST=../frontend/dist
export TMP_COOKIE_SECURE=true                      # behind HTTPS
export TMP_DATABASE_URL=postgresql+psycopg://user:pass@db/tomypetal   # add the psycopg driver
export TMP_MEDIA_ROOT=/var/lib/tomypetal/media
export TMP_MODEL_DIR=/var/lib/tomypetal/model
uv run alembic upgrade head
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 --proxy-headers
```

Put a TLS-terminating reverse proxy (Caddy, nginx) in front. Set the request-body limit there to at least
`TMP_MAX_UPLOAD_MB` (default 12 MB) plus some headroom.

If the frontend must live on another origin, add it to `TMP_CORS_ORIGINS`, keep `SameSite=Lax` only if both
share a registrable domain, otherwise use `TMP_COOKIE_SAMESITE=none` together with `TMP_COOKIE_SECURE=true`.

## Processing strategy and its limits

- Analyses run **synchronously inside the request** (in FastAPI's thread pool), and the validated result is
  written to the database before the response. No job state lives in process memory, so any number of API
  workers or containers can run behind a load balancer.
- Each worker process loads the model once at start-up: about 20 MB of weights plus PyTorch (roughly
  300–500 MB resident per worker). Size memory accordingly.
- One CPU prediction takes well under a second on a modern CPU. Under heavy concurrency, requests queue in
  the thread pool. If that becomes a problem, move inference to a separate worker service with a durable
  queue (e.g. a database-backed job table) rather than in-process background tasks.
- Set `TMP_TORCH_THREADS` (e.g. 1–2) when running several workers on one machine to avoid oversubscription.

## Storage

- Photos live under `TMP_MEDIA_ROOT/u<user_id>/<random>.jpg`. Back the folder up together with the database.
  For several hosts, mount shared storage (NFS, EFS) or replace `app/storage.py` with an object-store backend
  that keeps the same owner checks.
- Photos are served only through `/api/photos/{id}/file`, after an ownership check. Don't expose the media
  folder through the web server.

## Database

- SQLite is fine for a single small instance (WAL mode is enabled). Use PostgreSQL for multi-worker deployments.
- Run `uv run alembic upgrade head` on every deploy before starting the new version.

## Security checklist

- HTTPS only; `TMP_COOKIE_SECURE=true`.
- Restrict `TMP_CORS_ORIGINS` to your real frontend origin(s).
- Keep `/api/docs` behind authentication or disable it in public deployments if you prefer.
- Login lockout is per account (5 failures, 10 minutes). Add IP-based rate limiting at the proxy too.
- No secrets are needed in the frontend; nothing secret is stored in git (`.env` is ignored).

## PWA

`frontend/public/sw.js` caches only the app shell (HTML, hashed assets, icons). It never caches `/api/` calls,
so plant data, photos and analyses always need the network, and the UI shows an offline notice.
