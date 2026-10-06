# to my petal

*Care begins with understanding.*

An AI-assisted plant health and visual journaling web app. Keep a collection of plants, photograph
their leaves, get **careful, honest** suggestions about possible leaf issues for supported species, and
watch each plant's story unfold in a visual journal with photo comparisons and care reminders.

<img width="2172" height="724" alt="Original design reference" src="https://github.com/user-attachments/assets/ba417711-70c0-43e9-937a-7956b943ee5c" />

The image above is the original design brief. Screenshots of the implemented app are in
[`docs/screenshots/`](docs/screenshots/).

## What it does

- **My garden**: add, edit, archive and delete plants (nickname, kind, variety, location, date acquired, notes, photo); search and filter.
- **Leaf analysis**: choose or create a plant, drag-and-drop or pick a photo, preview or replace it, optionally say when symptoms started, how often you water and how much light the plant gets. Upload progress is measured; processing is shown without fake percentages.
- **Honest results**: model prediction, what you told us, and curated care guidance are shown separately. Outcomes can be *possible issue*, *no known issue found*, *inconclusive*, *not supported yet* or *unavailable*. Alternatives and limitations are always listed. You can add corrections and notes, and save the result to the journal.
- **Plant journal**: a chronological timeline of photos, notes, analyses and care, filterable by plant, date and type; edit or delete your notes; compare two photos with a draggable (keyboard-accessible) slider or side by side.
- **Care reminders**: watering, wiping leaves, rotating for light and more; create, edit, complete (logged to the journal), reschedule, repeat.
- **Care guide**: searchable summaries of extension-service guidance with sources and review dates. No pesticide or fungicide instructions.
- **Settings**: profile, password, English or Albanian (draft) interface, reduced-motion preference, data export (ZIP with photos), example garden, account deletion.
- Responsive from phone to desktop, with safe-area bottom navigation on phones, and an installable PWA that caches only the app shell.

## The image model, honestly

| | |
|---|---|
| Supported plants | Tomato, potato, bell pepper (15 PlantVillage classes). Basil, Monstera and other plants are journal-only. |
| Training data | PlantVillage `raw/color`, lab-style photos of single leaves; leaf-grouped train/val/test split |
| Architecture | MobileNetV3-Large (ImageNet-pretrained), fine-tuned on CPU |
| Uncertainty | Temperature scaling, a validation-derived confidence threshold, an energy-based unfamiliar-input check, crop agreement, photo-quality heuristics |
| Results | See [docs/MODEL_CARD.md](docs/MODEL_CARD.md): lab test-set and real-world (PlantDoc) numbers are reported separately |

Weights are **not committed**. Without them the app runs normally and every analysis says
"Image analysis is unavailable right now". There is no demo mode and no canned predictions.
[ml/README.md](ml/README.md) rebuilds the model from public data.

## Repository layout

```
backend/   FastAPI + SQLAlchemy 2 + Alembic API, image storage, inference service, tests
frontend/  React 19 + TypeScript + Vite + Tailwind CSS 4 + React Router + TanStack Query + Motion
ml/        Dataset preparation, training, calibration and evaluation (PyTorch / torchvision)
docs/      Model card, API reference, deployment, asset attribution, screenshots
```

## Local setup

Requirements: **Python 3.12**, [**uv**](https://docs.astral.sh/uv/) ≥ 0.12, **Node.js 24** with npm.

```bash
# 1. Backend (from the repository root)
cd backend
uv sync --extra inference        # omit --extra inference to run without PyTorch (analysis = unavailable)
cp .env.example .env             # optional; defaults work for local development
uv run alembic upgrade head      # creates backend/var/tomypetal.db
uv run uvicorn app.main:app --reload --port 8000

# 2. Frontend (second terminal)
cd frontend
npm ci
npm run dev                      # http://localhost:5173 (proxies /api to :8000)
```

Open http://localhost:5173, create an account, and either add a plant or choose
**Show example garden** (clearly badged, read-only examples you can remove in one click).

### Enable real analysis

Train and evaluate a model ([ml/README.md](ml/README.md)), then copy the run folder into the backend:

```bash
mkdir -p backend/models/current
cp ml/artifacts/run-001/{model.pt,metadata.json,metrics.json} backend/models/current/
# restart the API; GET /api/system/model should report "available": true
```

## Database migrations

```bash
cd backend
uv run alembic upgrade head                                 # apply
uv run alembic revision --autogenerate -m "describe change" # after changing app/models.py
uv run alembic downgrade -1                                 # roll back one step
```

`TMP_DATABASE_URL` selects the database (SQLite by default; PostgreSQL in production).

## Quality checks

```bash
# backend
cd backend && uv sync --extra inference && uv run pytest && uv run ruff check . && uv run ruff format --check . && uv run mypy app
# ml
cd ml && uv sync --group dev && uv run pytest && uv run ruff check .
# frontend
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
# end-to-end (starts or reuses both dev servers)
cd frontend && npx playwright install chromium && npm run e2e
```

## Documentation

- [docs/MODEL_CARD.md](docs/MODEL_CARD.md): data, training, calibration, evaluation, limitations
- [ml/README.md](ml/README.md): dataset acquisition, preparation, training and evaluation commands
- [docs/API.md](docs/API.md): endpoint reference (interactive docs at `/api/docs`)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): single-origin deployment, workers, storage, security
- [docs/ASSETS.md](docs/ASSETS.md): photo, font and artwork attribution
- [`backend/.env.example`](backend/.env.example): every setting with comments

## Security notes

Argon2id password hashing (argon2-cffi); random server-side session tokens stored hashed; HttpOnly
SameSite cookies; a custom-header CSRF guard; explicit CORS origins; account lockout after repeated
failed logins. Uploads are decoded and checked for format, size and decoded dimensions
(decompression-bomb safe), re-encoded without metadata, stored under random names inside a per-user
folder with path-traversal checks, and served only to their owner. Deleting plants, photos or the
account removes the files too.

## Known limitations

- The classifier is trained on lab photos; real-world accuracy is much lower (see the model card). It
  covers only 15 conditions of three crops, classifies whole images (no localisation, so no overlays),
  and cannot prove an image shows a supported plant.
- Photo comparison is a visual tool only; the app never claims recovery or that a treatment worked.
- Albanian is a partial draft translation that falls back to English, and needs native review.
- Login throttling is per account; add IP rate limiting at the proxy for public deployments.
- No email verification or password reset by email (no mail service configured).
- Care guide summaries were written by the maintainers from extension publications, not reviewed by a plant pathologist.
- Analyses run synchronously in the request; see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for scaling limits.
