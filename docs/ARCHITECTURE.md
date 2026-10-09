# Architecture

This document shows how the system fits together. For details, see [BACKEND.md](BACKEND.md) and [FRONTEND.md](FRONTEND.md).

## 1. Topology

```
                 Browser (one origin)
                        │
         ┌──────────────┴───────────────┐
         │  Vercel (prod) / Vite (dev)  │
         │  serves the React SPA        │
         │  rewrites /api/*, /media/* ──┼──────────┐
         └──────────────────────────────┘          │
                                                   ▼
                                   ┌───────────────────────────────┐
                                   │  Django + DRF (Render/Railway)│
                                   │  /api/v1/public/  viewer      │
                                   │  /api/v1/admin/   owner only  │
                                   │  /api/v1/auth/    sudo login  │
                                   └──────┬───────────────┬────────┘
                                          │               │
                                     PostgreSQL     Media storage
                                                    (disk or S3/R2)
```

The browser only ever talks to one origin. As a result:

- the JWT cookies are first-party (`SameSite=Lax`, httpOnly),
- no CORS is needed in production,
- uploaded media URLs (`/media/...`) work unchanged in dev and prod.

## 2. The two switches: presentation mode × theme

```
             theme:  dark  │  light
mode: ─────────────────────┼──────────
  simple      ✓            │   ✓        (implemented)
  terminal    ✓            │   ✓        (implemented)
  3d          ·            │   ·        (planned; auto-degrades / falls back)
```

Both switches are attributes on `<html>` (`data-mode`, `data-theme`), and all styling reads CSS tokens keyed off them. The two are independent: any mode works in either theme.

## 3. Layering on the frontend: what's shared across modes

```
L5  Mode skins          modes/simple  modes/terminal  modes/three     ← only mode-specific code
L4  Shared UI           ui/*, sudo/inline (EditableSection/Item), switchers
L3  Domain              domain/sections.ts (view-models), domain/resources.ts (editable resources)
L2  Data                api/* (typed client + TanStack Query hooks)
L1  REST API            Django
```

A mode receives `SectionModel`s and decides how to present them. It never fetches data or calls admin endpoints itself. That is why one edit, made anywhere, updates every mode.

## 4. One write path for every edit

```
 Dashboard ResourcePage ──┐
 Inline EditableItem   ───┼──► EditorDrawer ──► ResourceForm ──► useAdminMutations ──► PATCH /api/v1/admin/<resource>/<id>/
 (Terminal `edit …`)   ───┘          ▲                (domain/resources.ts                      │
                                     │                 drives the fields)                       ▼
                                     └──── invalidate: admin cache + bootstrap ◄──── VersionedViewSetMixin records history
```

## 5. Request lifecycle: a visitor opening the home page

1. `index.html` applies the saved theme and mode before first paint, so there is no flash.
2. `PublicSite` → `useBootstrap()` → `GET /api/v1/public/bootstrap/`. This is a single aggregate payload with the profile, sections, timeline, projects, skills, posts, games and site settings.
3. `buildSections()` orders the sections by the owner's settings and drops empty ones.
4. The active mode's views are lazy-loaded (`useModeViews`) and render the sections.
5. `track("pageview")` sends a beacon to `/analytics/collect/`. There are no cookies, the visitor hash rotates daily, and nothing is sent while the owner is logged in.

## 6. Sudo authentication

```
POST /auth/login  {username,password} ──► superuser? ──► has TOTP? ── yes ──► {otp_required, challenge (signed, 5 min)}
                                                         │                           │
                                                         no (and 2FA not required)   ▼
                                                         │                POST /auth/otp/verify {challenge, code}
                                                         ▼                           │
                                         Set-Cookie: sudo_access (15 min, path /)  ◄─┘
                                                     sudo_refresh (7 d, path /api/v1/auth/)
```

- **CSRF:** every unsafe request authenticated by cookie must send `X-CSRFToken`.
- **Expired access token:** owner endpoints return 401. The SPA calls `/auth/refresh/` once and retries the request.
- **Public endpoints:** a stale cookie is simply treated as an anonymous visitor.

## 7. Where things live

| Concern | Backend | Frontend |
|---|---|---|
| Content (profile, timeline, projects, skills, posts) | `apps/profiles`, `experience`, `projects`, `skills`, `blog` | `domain/sections.ts`, `modes/*` |
| Section order / visibility, defaults, feature flags | `apps/site_config` | `PreferencesProvider.applySiteDefaults` |
| Uploads | `apps/media_library` (`MediaRefField`) | `sudo/media/MediaPicker` |
| History / restore | `apps/versioning` | `sudo/dashboard/pages/HistoryPage` |
| Inbox | `apps/contact` | `ContactSection`, `InboxPage` |
| Stats | `apps/analytics` | `lib/analytics.ts`, `AnalyticsPage` |
| Games & leaderboards | `apps/games` | (Phase 7) `games/`, `GamesPage` |
| Owner auth | `apps/accounts` | `api/auth.ts`, `LoginPage`, `SecurityPage` |
