# API reference

Interactive OpenAPI docs are served by the backend at **`/api/docs`** (Swagger UI) and `/api/redoc`;
the schema is at `/api/openapi.json`. This page summarises the conventions and endpoints.

## Conventions

- JSON in and out, except photo upload (`multipart/form-data`), photo files (`image/jpeg`) and export (`application/zip`).
- **Sessions**: `POST /api/auth/register` or `/login` sets an `HttpOnly`, `SameSite=Lax` cookie
  (`Secure` when `TMP_COOKIE_SECURE=true`). The token is random; the server stores only its SHA-256.
- **CSRF**: every non-GET request must send `X-Requested-With: to-my-petal`. Browsers can't add that header
  cross-site without a CORS preflight, and CORS only admits `TMP_CORS_ORIGINS`.
- **Ownership**: every resource belongs to one user. Another user's ID returns **404**, never 403, so IDs reveal nothing.
- **Errors**: `{"detail": "<message for people>"}`. Image rejections use `{"detail": {"code": "...", "message": "..."}}`
  with codes `empty`, `too_large`, `not_an_image`, `unsupported_format`, `too_small`, `too_big_dimensions`, `too_many_pixels`.
  Validation errors (422) follow FastAPI's list format.
- Dates are calendar dates (`YYYY-MM-DD`); timestamps are ISO 8601 in UTC.
- Example records (`is_example: true`) are read-only (409 on writes).

## Endpoints

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | `{email, password (≥10), display_name}` → user, sets cookie |
| POST | `/api/auth/login` | `{email, password}`; 5 failures lock the account for 10 minutes (429) |
| POST | `/api/auth/logout` | deletes the server-side session |
| GET | `/api/auth/me` | current user or 401 |

### Plants
| Method | Path | Notes |
|---|---|---|
| GET | `/api/plants?q=&species_key=&state=active\|archived\|all&examples=true` | includes entry counts and cover photo |
| POST | `/api/plants` | `{nickname, species_key, species?, location?, acquired_on?, notes?}` |
| GET / PATCH / DELETE | `/api/plants/{id}` | PATCH also takes `cover_photo_id` and `archived: bool`. DELETE removes photos (files too), analyses, entries and reminders |

`species_key` ∈ `tomato`, `potato`, `pepper_bell` (analysable), `basil`, `monstera`, `other` (journal only).

### Photos
| Method | Path | Notes |
|---|---|---|
| POST | `/api/photos` | multipart: `file`, `plant_id`, `taken_on?`, `description?`. Decoded, checked, EXIF-stripped, re-encoded |
| GET | `/api/photos?plant_id=` | newest first |
| GET / PATCH / DELETE | `/api/photos/{id}` | PATCH `{taken_on?, description?}` |
| GET | `/api/photos/{id}/file?variant=full\|thumb` | owner-only JPEG, `Cache-Control: private` |

### Analyses
| Method | Path | Notes |
|---|---|---|
| POST | `/api/analyses` | `{photo_id, symptoms_started?, watering?, light?, recent_changes?}`; runs inference synchronously and stores a validated result |
| POST | `/api/analyses/{id}/rerun` | re-run (e.g. after a model becomes available) |
| GET | `/api/analyses?plant_id=&limit=&offset=` | paginated `{items, total, limit, offset}` |
| GET / PATCH / DELETE | `/api/analyses/{id}` | PATCH `{user_correction?, user_notes?}` (never changes model output) |
| POST | `/api/analyses/{id}/journal` | `{note?}` saves to the journal (idempotent) |

Result document (`result`), validated by `app/inference/schemas.py`:

```jsonc
{
  "outcome": "possible_issue | no_known_issue | inconclusive | unsupported_species | unsupported_image | model_unavailable",
  "headline": "Possible early blight",
  "explanation": "The model suggests this leaf resembles early blight: …",
  "primary": { "label": "Tomato___Early_blight", "condition": "Early blight", "strength": "closer",
               "calibrated_score": "<0–1>", "guide_slug": "early-blight", … } ,
  "alternatives": [ … up to 3 … ],
  "reasons": ["low_confidence" | "crop_mismatch" | "unfamiliar_image" | "quality_blurry" | …],
  "limitations": ["…"],
  "quality": { "brightness": 0.46, "sharpness": 812.3, "issues": [] },
  "model": { "available": true, "version": "pv15-…", "controlled_test_macro_f1": "<from metrics.json>", "real_world_macro_f1": "<from metrics.json>" }
}
```

The response also carries `context` (what the user reported) and `context_notes` (curated care-guide notes,
`source: "care_guide"`), kept apart from model output.

### Journal
| Method | Path | Notes |
|---|---|---|
| GET | `/api/journal?plant_id=&kind=&date_from=&date_to=&with_photo=&limit=&offset=` | newest first, paginated |
| POST | `/api/journal` | `{plant_id, kind: observation\|photo\|care, entry_date, title?, body?, photo_id?, care_kind?}` |
| GET / PATCH / DELETE | `/api/journal/{id}` | DELETE `?delete_photo=true` also removes an unused photo |

### Reminders
| Method | Path | Notes |
|---|---|---|
| GET | `/api/reminders?state=active\|all&plant_id=` | ordered by due date |
| POST | `/api/reminders` | `{kind, title, due_on, repeat_days?, plant_id?, notes?}` |
| PATCH / DELETE | `/api/reminders/{id}` | reschedule with `due_on`; `clear_repeat: true` makes it one-off |
| POST | `/api/reminders/{id}/complete` | `{completed_on?, log_to_journal=true, note?}`; repeating reminders roll forward |

### Account and data
| Method | Path | Notes |
|---|---|---|
| PATCH | `/api/account` | `{display_name?, locale: en\|sq, motion_preference: system\|reduce\|full}` |
| POST | `/api/account/password` | signs out other sessions |
| GET | `/api/account/export` | ZIP: `data.json` + `photos/` |
| DELETE | `/api/account` | `{password}`; deletes all rows and the user's photo folder |
| POST / DELETE | `/api/account/examples` | add / remove the example garden |

### Other
| Method | Path | Notes |
|---|---|---|
| GET | `/api/dashboard` | latest analysis, three plant stories, upcoming reminders, model status |
| GET | `/api/guide?q=&plant=&kind=` · `/api/guide/{slug}` | curated care guide (public) |
| GET | `/api/system/model` | model availability, version, evaluation summary |
| GET | `/api/health` | liveness |
