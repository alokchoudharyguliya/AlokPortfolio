# Backend reference

Django 5.2 + Django REST Framework. Every app lives in `backend/apps/<name>/` and follows the same layout:

```
models.py        data
serializers.py   API shape (read + write)
views.py         viewsets / API views
urls.py          exposes public_urlpatterns and admin_urlpatterns (mounted in config/urls.py)
admin.py         Django-admin registration (fallback tool at /django-admin/)
tests.py         pytest tests
__init__.py      app docstring: responsibilities and connections
```

## 1. Apps and dependencies

```
                      core  (abstract models, Tag, IsOwner, OwnerModelViewSet, error envelope)
                        ▲
    ┌──────────┬────────┼─────────┬──────────┬──────────┬──────────┐
 accounts  media_library  versioning   │       contact   analytics   games
                ▲             ▲        │
                └─────┬───────┘        │
   profiles  experience  projects  skills  blog     (content apps)
                        ▲
                   site_config  (aggregator: imports content apps, never the reverse)
```

| App | Responsibility | Models |
|---|---|---|
| `core` | Shared base classes, owner permission, reorder action, uniform errors | `Tag` + abstract `TimeStamped`, `Orderable`, `Publishable`, `Singleton` |
| `accounts` | Owner login, TOTP 2FA, JWT cookies, CSRF | `User` (custom) + django-otp `TOTPDevice` |
| `media_library` | The single upload pipeline, `MediaRefField` | `MediaAsset` |
| `versioning` | Snapshots on every owner write; diff and restore | `Version` |
| `profiles` | Who the owner is | `Profile` (singleton), `SocialLink`, `FocusArea`, `ResumeVersion` |
| `experience` | Timeline | `Experience`, `Education`, `Achievement` |
| `projects` | Projects with metrics, gallery, tags | `Project` |
| `skills` | Skill inventory | `SkillCategory`, `Skill` |
| `blog` | Markdown posts, drafts, scheduling | `Post` |
| `contact` | Visitor messages and inbox | `Message` |
| `analytics` | Cookie-less first-party stats | `Event` |
| `games` | Game registry, leaderboards, anti-cheat | `Game`, `Score` |
| `site_config` | Settings, section order, `/bootstrap/` aggregate, seed command | `SiteConfig` (singleton), `Section` |

## 2. Data model (simplified ER)

```
Profile 1 ── avatar ──► MediaAsset ◄── cover ── Project ──M2M── Tag ──M2M── Post
SiteConfig ── og_image ─┘    ▲   ▲                  │                      │
ResumeVersion ── asset ──────┘   └── logo ── Experience ──M2M── Tag        └─ cover ─► MediaAsset
SkillCategory 1 ── * Skill
Section (fixed keys: hero, about, focus, experience, projects, skills, education,
         achievements, blog, arcade, contact)
Game 1 ── * Score            Version ── ContentType + object_id (generic)
Message, Event (standalone)
```

Conventions:

- `order` (from `OrderableModel`) drives manual ordering.
- `is_published` (from `PublishableModel`) hides a row from public APIs.
- A null `end_date` means "present".
- Image and file FKs use `on_delete=SET_NULL`, so deleting an upload never breaks content.

## 3. API surface

Swagger UI is at `/api/docs/` and the raw schema at `/api/schema/`.

### Public (`/api/v1/public/`)

| Method | Path | Notes |
|---|---|---|
| GET | `bootstrap/` | Everything for the homepage in one request. `?drafts=1` includes unpublished rows (owner only). |
| GET | `projects/`, `projects/<slug>/` | Published projects |
| GET | `posts/`, `posts/<slug>/` | Live posts (published, not scheduled), paginated |
| POST | `contact/` | Visitor message (honeypot field `website`, throttle `contact`) |
| POST | `analytics/collect/` | Event beacon (no auth, no cookies) |
| GET | `games/`, `games/<slug>/leaderboard/` | Enabled games, top 10 |
| POST | `games/<slug>/session/`, `games/<slug>/scores/` | Signed session → score submit |
| GET | `health/` | Liveness |

### Owner (`/api/v1/admin/`, `IsOwner`)

Collections support `GET/POST <res>/`, `GET/PATCH/DELETE <res>/<id>/` and `POST <res>/reorder/ {"ids": [...]}`:

`social-links`, `focus-areas`, `resumes`, `experience`, `education`, `achievements`, `projects`, `skill-categories`, `skills`, `posts`, `tags`, `sections` (no create/delete).

| Path | Notes |
|---|---|
| `profile/`, `site/` | Singletons: GET/PATCH |
| `media/` | Multipart upload, list (`?kind=`, `?search=`), metadata edit, delete (removes the file) |
| `messages/`, `messages/unread_count/`, `messages/mark_all_read/` | Inbox; message content is immutable, only flags change |
| `versions/?resource=projects.project&object_id=3`, `versions/<id>/`, `versions/<id>/restore/` | History, diff, restore |
| `analytics/summary/?days=30` | Totals, daily series, breakdowns |
| `overview/` | Dashboard counters |
| `games/`, `games/<id>/reset/`, `scores/` | Toggle games, moderate scores |

### Auth (`/api/v1/auth/`)

`csrf/`, `login/`, `otp/verify/`, `refresh/`, `logout/`, `me/`, `otp/setup/`, `otp/confirm/`, `otp/disable/`. See the flow in [ARCHITECTURE.md §6](ARCHITECTURE.md#6-sudo-authentication).

### Error envelope

Every error (validation, auth, throttling, 404) has this shape:

```json
{"error": {"status": 400, "code": "invalid", "message": "Please correct the errors below.", "fields": {"title": ["This field may not be blank."]}}}
```

## 4. Key mechanisms

- **`OwnerModelViewSet`** (`core/viewsets.py`) combines the IsOwner permission, CRUD, `reorder` and `VersionedViewSetMixin`. Most admin viewsets are 3–5 lines.
- **Versioning** takes its snapshot after `serializer.save()`, so many-to-many fields like tags are captured. Restore runs the snapshot back through Django's deserializer, drops references to rows that no longer exist, and records a `restore` version.
- **`MediaRefField`** writes an asset id and reads back `{id, url, alt, kind, width, height}`. Content APIs therefore stay JSON-only; uploads go through `/admin/media/` alone.
- **`TagNamesField`** reads and writes tags as a plain list of names, creating unknown tags on save (case-insensitive dedupe).
- **Bootstrap** (`site_config/selectors.py`) runs the same serializers as the admin API. An object can be passed straight from the live page to the editor.
- **Anti-cheat** (`games/services.py`):
  - the session token is signed and records the game, start time and a nonce;
  - the nonce is unique per score;
  - the claimed duration must not exceed the real time elapsed;
  - `score ≤ max_score_rate × seconds`.
- **Privacy**: `core.utils.visitor_hash` = sha256(IP + user agent + secret + day). Raw IPs are never stored, and analytics keeps only the referrer's host.

## 5. Settings and environment

`config/settings/{base,dev,test,prod}.py`. Every variable is listed in `backend/.env.example`. Notable ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres DSN |
| `SUDO_REQUIRE_TOTP` | Refuse password-only owner login (default: on in prod, off in dev) |
| `SERVE_MEDIA` | Django serves `/media/` (needed for disk storage) |
| `AWS_STORAGE_BUCKET_NAME` (+ keys, endpoint) | Switches uploads to S3/R2 with no code change |
| `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` | Only needed when the frontend runs on another origin. In `dev`, LAN origins are added automatically so a friend on the same network can use `http://<lan-ip>:5173`. |

## 6. Management commands

| Command | Use |
|---|---|
| `seed_portfolio [--force]` | Load the initial content (`site_config/seed_data.py`) |
| `setup_totp <username>` | Create the owner's TOTP device from the server shell (first prod login) |
| `createsuperuser` | Create the owner account |

## 7. Tests

`pytest` (73 tests) covers:

- auth flows: cookies, TOTP, refresh rotation and blacklist, CSRF, stale cookies;
- owner permission on every admin endpoint;
- reorder, tags, versioning (diff, restore, restore-after-delete, M2M);
- bootstrap filtering, drafts and feature flags;
- media validation and `SET_NULL`;
- blog scheduling and slugs;
- contact honeypot and throttle;
- analytics aggregation and referrer stripping;
- game anti-cheat.
