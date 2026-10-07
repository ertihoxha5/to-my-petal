<div align="center">

# 🌿 to my petal

### A little care. A little bloom.

*Care begins with understanding.*

An AI-assisted plant health and visual journaling web app.  
Understand possible leaf issues, keep thoughtful care notes,  
and follow your plant’s story—one photograph at a time.

<img src="https://img.shields.io/badge/React_19-173D29?style=flat-square&logo=react&logoColor=white" alt="React 19" />
<img src="https://img.shields.io/badge/TypeScript-173D29?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/FastAPI-A5B39A?style=flat-square&logo=fastapi&logoColor=173D29" alt="FastAPI" />
<img src="https://img.shields.io/badge/PyTorch-DDA297?style=flat-square&logo=pytorch&logoColor=173D29" alt="PyTorch" />
<img src="https://img.shields.io/badge/Installable_PWA-F0E8D8?style=flat-square&logoColor=173D29" alt="Installable PWA" />

<br />
<br />

[Experience](#-a-little-care-in-every-feature) ·
[Image model](#-the-image-model-honestly) ·
[Getting started](#-grow-it-locally) ·
[Documentation](#-documentation)

</div>

---

<div align="center">

<img width="2172" height="724" alt="Original botanical design reference for to my petal" src="https://github.com/user-attachments/assets/ba417711-70c0-43e9-937a-7956b943ee5c" />

*Warm ivory. Forest green. A little blush. A space for your plants.*

</div>

The image above is the **original design reference**. Screenshots of the implemented application are available in [`docs/screenshots/`](docs/screenshots/).

## 🌱 Every plant has a story

A yellowing edge. A few unfamiliar spots. A leaf that looks different from last week.

**to my petal** brings those observations together with image analysis, care guidance, and a personal plant journal. Add your plants, upload leaf photographs, explore possible issues for supported species, and return with follow-up photos.

The application keeps **model predictions, your observations, and curated guidance separate**, so you can understand what each finding is based on.

> **Share a leaf → Explore the findings → Save an observation → Return with a follow-up**

## 🍃 A little care in every feature

| Feature | What you can do |
| :--- | :--- |
| **My garden** | Add, edit, archive, delete, search, and filter your plants. |
| **Leaf analysis** | Upload a photograph and provide context about symptoms, watering, and light. |
| **Honest results** | Review possible findings, alternatives, uncertainty, and limitations. |
| **Plant journal** | Keep a timeline of photos, notes, analyses, and completed care actions. |
| **Photo comparison** | Compare two dated photos with an accessible slider or side-by-side view. |
| **Care reminders** | Create, repeat, complete, and reschedule plant care tasks. |
| **Care guide** | Browse searchable, source-backed care summaries. |
| **Settings** | Manage your profile, language, motion preferences, exports, and account. |

<details>
<summary><strong>🌿 My garden</strong></summary>

<br />

Create a personal collection with:

- Nickname, plant kind, and variety.
- Location and acquisition date.
- Notes and a plant photograph.
- Search and filtering.
- Editing, archiving, and deletion.

</details>

<details>
<summary><strong>🔎 Leaf analysis and careful results</strong></summary>

<br />

Choose an existing plant or create one, then drag and drop a photograph or select a file. Preview or replace the image before uploading.

You can optionally describe:

- When the symptoms started.
- How often you water.
- How much light the plant receives.

Upload progress is measured. Processing is displayed without fabricated percentages.

Results distinguish:

1. **Model prediction**
2. **What you told us**
3. **Curated care guidance**

Possible outcomes include:

- **Possible issue**
- **No known issue found**
- **Inconclusive**
- **Not supported yet**
- **Unavailable**

Alternatives and limitations accompany the result. Add corrections or notes and save it to your plant’s journal.

</details>

<details>
<summary><strong>📖 A visual plant journal</strong></summary>

<br />

Follow a chronological timeline of photographs, notes, analyses, and care actions.

- Filter by plant, date, and entry type.
- Edit or delete your notes.
- Select two photographs to compare.
- Use a draggable, keyboard-accessible comparison slider.
- Switch to a side-by-side view.

Photo comparison documents visible changes. It does not establish recovery or prove that a treatment worked.

</details>

<details>
<summary><strong>💧 Care reminders and guidance</strong></summary>

<br />

Create reminders for watering, wiping leaves, rotating for light, and other care tasks.

Reminders can be edited, completed, rescheduled, or repeated. Completed care is recorded in the journal.

The care guide contains searchable summaries of extension-service publications, with sources and review dates. It does not provide pesticide or fungicide instructions.

</details>

<details>
<summary><strong>⚙️ Your preferences, your plants</strong></summary>

<br />

Settings include:

- Profile and password management.
- English or Albanian interface content.
- Reduced-motion preference.
- Data export as a ZIP, including photographs.
- A clearly labeled, read-only example garden.
- Account deletion.

Albanian is a partial draft translation and falls back to English where needed.

</details>

## 🌸 A digital garden

The interface combines botanical imagery, editorial typography, warm surfaces, and subtle motion.

| Colour | Hex | Role |
| :--- | :--- | :--- |
| Warm ivory | `#F8F5EC` | Background |
| Soft cream | `#FFFCF5` | Card surfaces |
| Forest green | `#173D29` | Brand and primary actions |
| Sage | `#A5B39A` | Botanical accents |
| Blush | `#DDA297` | Petal details |
| Dark ink | `#18251C` | Text |

The experience adapts from desktop to phone, with safe-area-aware bottom navigation on mobile.

The installable **PWA caches the application shell only**. Image analysis still requires the backend and available model weights.

## 🧠 The image model, honestly

| Component | Details |
| :--- | :--- |
| **Supported plants** | Tomato, potato, and bell pepper: 15 PlantVillage classes. |
| **Journal-only plants** | Basil, Monstera, and other unsupported plants can still have profiles and journals. |
| **Training data** | PlantVillage `raw/color` lab photographs, plus real-world PlantDoc photographs. |
| **Data split** | PlantVillage split by physical leaf; PlantDoc split by near-duplicate group, with 310 real-world photos held out for testing. |
| **Architecture** | ImageNet-pretrained MobileNetV3-Large, fine-tuned on CPU. |
| **Uncertainty handling** | Temperature scaling, a confidence threshold fitted on real-world validation photos, an energy-based unfamiliar-input check, a leaf-likeness check, crop agreement, and photo-quality heuristics. |
| **Lab test set** | 3,434 PlantVillage photos: accuracy 0.99, macro F1 0.99. |
| **Held-out real-world set** | 310 PlantDoc photos: accuracy 0.55, macro F1 0.55. The app shows a finding for about 22% of them, and those findings are right about 79% of the time (95% CI 68–87%). |

The current model (`pv15-mobilenetv3large-20261007-18cfae9b`) was fine-tuned with real-world photos.
On the same held-out photos, this raised macro F1 from 0.28 to 0.55 and the accuracy of shown findings
from 37% to 79%. Most garden photos are still declined as inconclusive.

Read [`docs/MODEL_CARD.md`](docs/MODEL_CARD.md) for training, evaluation, calibration, and limitations.

### Real inference, or an honest unavailable state

Model weights are **not committed**.

Without weights, the garden and journal remain usable, while analyses display:

> “Image analysis is unavailable right now.”

There is **no demo prediction mode and no canned analysis**.

See [`ml/README.md`](ml/README.md) to rebuild the model from public data.

## 🪴 Inside the project

| Directory | Contents |
| :--- | :--- |
| [`frontend/`](frontend/) | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, TanStack Query, and Motion. |
| [`backend/`](backend/) | FastAPI, SQLAlchemy 2, Alembic, image storage, inference service, and tests. |
| [`ml/`](ml/) | Dataset preparation, training, calibration, and evaluation with PyTorch and torchvision. |
| [`docs/`](docs/) | Model card, API reference, deployment guidance, asset attribution, and screenshots. |

## 🌱 Grow it locally

### Requirements

- **Python 3.12**
- **[uv](https://docs.astral.sh/uv/) ≥ 0.12**
- **Node.js 24** with npm

### 1. Start the backend

From the repository root:

```bash
cd backend

uv sync --extra inference

cp .env.example .env

uv run alembic upgrade head

uv run uvicorn app.main:app --reload --port 8000
```

The environment file is optional for local development; defaults work locally.

Migrations create `backend/var/tomypetal.db`.

To run without PyTorch, use `uv sync` instead of `uv sync --extra inference`. Image analysis will remain unavailable.

### 2. Start the frontend

In a second terminal, starting from the repository root:

```bash
cd frontend

npm ci

npm run dev
```

Open **[localhost:5173](http://localhost:5173)**.

The development server proxies `/api` requests to the backend on port `8000`.

### 3. Meet your first plant

Create an account and add a plant, or select **Show example garden**.

Example plants are clearly labeled and read-only. Remove the example garden in one click when you are ready to start your own.

### 4. Enable real image analysis

Follow the training and evaluation instructions in [`ml/README.md`](ml/README.md).

For a completed run at `ml/artifacts/run-002` (the real-world fine-tuned model), execute from the repository root:

```bash
mkdir -p backend/models/current

cp ml/artifacts/run-002/{model.pt,metadata.json,metrics.json} backend/models/current/
```

Restart the API.

`GET /api/system/model` should report:

```json
{
  "available": true
}
```

The copy commands above use Bash syntax. On Windows, use Git Bash or copy the three files manually.

## 🗃️ Database migrations

Run from `backend/`.

**Apply migrations:**

```bash
uv run alembic upgrade head
```

**Create a migration after changing `app/models.py`:**

```bash
uv run alembic revision --autogenerate -m "describe change"
```

**Roll back one migration:**

```bash
uv run alembic downgrade -1
```

`TMP_DATABASE_URL` selects the database: SQLite by default, or PostgreSQL for production.

## 🧪 Quality checks

Run each group from its indicated directory.

<details>
<summary><strong>Backend</strong></summary>

<br />

From `backend/`:

```bash
uv sync --extra inference
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run mypy app
```

</details>

<details>
<summary><strong>Machine learning</strong></summary>

<br />

From `ml/`:

```bash
uv sync --group dev
uv run pytest
uv run ruff check .
```

</details>

<details>
<summary><strong>Frontend</strong></summary>

<br />

From `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

</details>

<details>
<summary><strong>End-to-end</strong></summary>

<br />

From `frontend/`:

```bash
npx playwright install chromium
npm run e2e
```

The end-to-end workflow starts or reuses both development servers.

</details>

## 📚 Documentation

| Document | What you will find |
| :--- | :--- |
| [`MODEL_CARD.md`](docs/MODEL_CARD.md) | Data, training, calibration, evaluation, and limitations. |
| [`ML README`](ml/README.md) | Dataset acquisition, preparation, training, and evaluation commands. |
| [`API.md`](docs/API.md) | Endpoint reference; interactive API documentation is available at `/api/docs`. |
| [`DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Single-origin deployment, workers, storage, and security. |
| [`ASSETS.md`](docs/ASSETS.md) | Photograph, font, and artwork attribution. |
| [`.env.example`](backend/.env.example) | Backend settings with explanatory comments. |
| [`screenshots/`](docs/screenshots/) | Screenshots of the implemented application. |

## 🔐 Private plants, thoughtful storage

Authentication uses:

- Argon2id password hashing through `argon2-cffi`.
- Random server-side session tokens stored as hashes.
- HttpOnly, SameSite cookies.
- A custom-header CSRF guard.
- Explicit CORS origins.
- Account lockout after repeated failed logins.

Uploaded images are decoded and checked for format, file size, and decoded dimensions, including decompression-bomb protection.

Images are re-encoded without metadata, stored under random names in per-user folders, checked against path traversal, and served only to their owner.

Deleting plants, photos, or an account also removes the associated files.

## 🍂 Known limitations

- **Limited model scope:** the classifier covers 15 conditions across three crops.
- **Real-world accuracy:** well below lab accuracy, and measured on a small held-out set (310 photographs). See the model card.
- **No localisation:** the classifier analyzes whole images and does not produce disease-location overlays.
- **Unsupported inputs:** the model cannot prove that an image depicts a supported plant.
- **Visual comparisons:** photographs do not establish recovery or treatment effectiveness.
- **Draft Albanian:** translation is partial, falls back to English, and needs native review.
- **Login throttling:** throttling is per account; public deployments also need proxy-level IP rate limiting.
- **No email recovery:** email verification and password reset by email are not configured.
- **Care content:** maintainers summarized extension publications; a plant pathologist has not reviewed the summaries.
- **Synchronous inference:** analyses run within the request. See the deployment documentation for scaling limits.

---

<div align="center">

### to my petal 🌸

*Care begins with understanding.*

Created by **[Erti Hoxha](https://ertihoxha.com)**

**A little care. A little bloom.**

</div>
