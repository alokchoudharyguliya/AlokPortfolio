# Portfolio Platform — Plan

> Status: **Backend, Simple, Terminal, 3D and Sudo mode are built and verified. Drive mode is scoped (§2.5, D16–D23); implementation has not started.**
> Owner profile: Alok Choudhary — Software / AI Systems Engineer
> Last updated: 2026-10-08

---

## 0. Goal

A personal portfolio platform with two **access levels** and three **presentation modes**.

| Access level | Who | What they can do |
|---|---|---|
| **Viewer** | Public visitors | Browse profile, experience, projects, skills and blog; switch modes and themes; play games; send messages |
| **Sudo** | Owner only (password + TOTP) | Create, edit, reorder, hide and delete all public content; upload media and resume; read the inbox; view analytics; restore old versions; set defaults |

| Presentation mode | Feel |
|---|---|
| **Simple** | Clean editorial layout, big type, GSAP scroll animations |
| **Terminal** | Interactive shell: `ls projects`, `cat about`, `play snake`, plus tappable chips |
| **3D** | Three.js scenes (GPU / data-flow theme) that auto-degrade on weak devices |
| **Drive** *(proposed)* | A first-person drive through the portfolio: the road is the page, sections are checkpoints (§2.5) |

Each mode has a **dark** and a **light** theme. Every layout must work in portrait and landscape and on mobile browsers. Sound is optional and muted by default. The code must be documented thoroughly: components, their responsibilities, and how they connect.

---

## 1. Source Content

- [x] Long-form profile text (pasted in chat)
- [ ] Resume PDF: the Drive link needs sign-in. **Need the PDF dropped into this folder, or the text pasted**
- [ ] LinkedIn: blocks automated fetching. **Need dates, titles and certifications pasted**
- [ ] Profile photo / avatar (optional)
- [ ] Project screenshots, demo links, GitHub URLs
- [ ] Contact links (email, GitHub, LinkedIn, X, …)

---

## 2. Architecture

### 2.0 Repository layout

```
alokProjects/
├── plan.md
├── docker-compose.yml          # postgres + backend + frontend (dev)
├── docs/                       # Architecture, API reference, component map, runbooks
├── backend/                    # Django + Django REST Framework
│   ├── config/                 # settings/{base,dev,prod}.py, urls.py, wsgi/asgi
│   └── apps/
│       ├── core/               # Abstract models (TimeStamped, Orderable, Publishable), permissions, pagination, utils
│       ├── accounts/           # Owner auth: password + TOTP 2FA, JWT in httpOnly cookies, rate limiting
│       ├── profiles/           # Hero, about, philosophy, career focus, social links, resume files (versioned)
│       ├── experience/         # Work experience, education, leadership, achievements
│       ├── projects/           # Projects, tech tags, images, links, featured flag
│       ├── skills/             # Skill categories + skills
│       ├── blog/               # Markdown posts, tags, draft/published, reading time
│       ├── contact/            # Contact messages → owner inbox (read/star/archive), spam protection
│       ├── media_library/      # Uploaded images/files (local disk; storage setting allows a later move to S3)
│       ├── site_config/        # Default mode/theme, section order and visibility, SEO meta, feature flags
│       ├── analytics/          # Privacy-friendly page views, mode usage, game plays (no third-party trackers)
│       ├── games/              # Game registry, score submission, leaderboards
│       └── versioning/         # Edit history for content models: view diffs, restore
└── frontend/                   # React + Vite + TypeScript SPA
    └── src/
        ├── api/                # L2: typed client + TanStack Query hooks
        ├── domain/             # L3: view-models / hooks per section
        ├── ui/                 # L4: shared primitives, Editable* wrappers, switchers
        ├── modes/              # L5: simple/ terminal/ three/ + registry
        ├── games/              # Shared game engine + 3 games (mode-agnostic)
        ├── sudo/               # Dashboard pages (inbox, media, analytics, history, settings)
        ├── lib/                # motion presets, sound, device capability, theme
        └── styles/             # design tokens per [data-mode][data-theme]
```

**Backend:** Django, DRF, PostgreSQL, drf-spectacular (OpenAPI), simplejwt (cookie-based), django-otp (TOTP), django-filter, Pillow, pytest-django.

**Frontend:** React, Vite, TypeScript, React Router, TanStack Query, GSAP + ScrollTrigger, anime.js, Lenis, Three.js / React Three Fiber + drei, Howler.js, react-hook-form + zod, dnd-kit, a markdown renderer and editor, Vitest + Testing Library.

### 2.1 Presentation modes: layered for maximum reuse

There are two independent switches:
- **Mode** = how the site is presented: `simple` | `terminal` | `3d`
- **Theme** = color scheme: `dark` | `light`

That gives 3 × 2 combinations, all built on the same design tokens.

```
┌───────────────────────────────────────────────────────────────┐
│ L5  Mode skins (the ONLY mode-specific code)                  │
│     modes/simple/   modes/terminal/   modes/three/            │
│     each implements the same SectionRenderer contract         │
├───────────────────────────────────────────────────────────────┤
│ L4  Shared UI primitives                                       │
│     <Editable*> wrappers, buttons, modals, toasts, icons,      │
│     ModeSwitcher, ThemeToggle, SoundToggle, GameLauncher       │
├───────────────────────────────────────────────────────────────┤
│ L3  Domain hooks / view-models (mode-agnostic)                 │
│     useProfile(), useProjects(), useExperience(), useSkills(), │
│     usePosts(), useSectionOrder(), useEditMode(), useSound()   │
├───────────────────────────────────────────────────────────────┤
│ L2  Data layer: typed API client + TanStack Query cache        │
├───────────────────────────────────────────────────────────────┤
│ L1  Django REST API (identical for every mode)                 │
└───────────────────────────────────────────────────────────────┘
```

**Key patterns**
- **Mode registry**: `modes/index.ts` maps `ModeId → { Layout, sections: Record<SectionKey, Component>, capabilities }`. Adding a fourth mode means adding one folder and one registry entry.
- **SectionRenderer contract**: each section (hero, about, experience, projects, skills, leadership, blog, contact, arcade) receives the same typed view-model props in every mode. Data fetching never happens inside a skin.
- **Section order and visibility** come from `site_config` and are honored by every mode.
- **Design tokens**: CSS variables (`--color-bg`, `--font-mono`, `--motion-ease` …) defined per `[data-mode][data-theme]`.
- **Shared animation presets** (GSAP / anime.js timelines) live in `lib/motion/`; skins compose them rather than re-writing them.
- **Edit layer is mode-agnostic**: owner mutations go through shared hooks (`useUpdateProject` …). The dashboard, inline editing in Simple and 3D, and Terminal commands all call the same code.
- **Mode switching** keeps the current route and section, persists the choice (localStorage + URL `?mode=`), and plays a transition (e.g. a "reboot" effect).

### 2.2 Games: one shared engine, three games, placed across the site

`frontend/src/games/` holds a small engine: a loop with requestAnimationFrame, unified keyboard/touch/swipe input, canvas resize handling for portrait and landscape, pause on tab blur, sound hooks and score submission. Each game is a plugin, and every mode reaches games through `GameLauncher`.

| Game | Concept | Where it appears *(proposal)* |
|---|---|---|
| **Pop the Bugs** | Bugs / cache misses float up; pop them before they reach "prod". Combos and pop sounds | Hero easter egg in Simple (click the floating bug), 404 page, Arcade section |
| **Token Snake** | The snake eats tokens and its KV cache grows; you lose on "OOM" | Terminal (`play snake`), Arcade section |
| **Warp Scheduler** | Assign GPU warps to SMs before the latency deadline | 3D mode GPU scene (click the GPU die), Skills → GPU/CUDA card, Arcade section |

Backend `games` app: game registry, score submission (nickname, lightweight anti-cheat via signed session token + sanity bounds), per-game leaderboards; the owner can moderate or reset leaderboards in sudo.

### 2.3 Sound

Howler.js sprite sheets. UI ticks and whooshes, a keyboard click in Terminal, and game sounds. **Muted by default**; the setting persists; sound respects `prefers-reduced-motion` and is never auto-played before a user gesture.

### 2.4 API shape

- `/api/v1/public/...`: read-only, published content only, cacheable
- `/api/v1/admin/...`: owner-only CRUD, reorder, publish/hide, history/restore, inbox, analytics
- `/api/v1/auth/...`: login, TOTP verify, refresh, logout, `me`
- `/api/v1/games/...`: scores + leaderboards
- `/api/v1/analytics/collect`: beacon endpoint (hashed IP + UA, no cookies)
- `/api/docs/`: Swagger UI (drf-spectacular)

### 2.5 Drive mode *(scoped; decisions D16–D23)*

**Pitch.** The visitor sits inside a car. The road comes toward them, arrow keys steer, and the portfolio is the route: each section is a checkpoint, and driving into it opens that section's content. It is the same content Simple mode shows on scroll, reached by driving instead.

**Why it is cheap to add.** It is the fourth skin on the existing layers, so these already exist and are reused unchanged:

| Reused | From |
|---|---|
| Ordered, filtered sections → the route (owner reorders in sudo = the road changes) | `domain/sections.ts` |
| Checkpoint panels: Simple's section components inside a glass panel, so inline editing, the contact form and markdown all work | `modes/three/sections.tsx` pattern |
| Mode registry, switcher, saved choice, `?mode=drive` | `modes/registry.ts`, `PreferencesProvider` |
| three.js (already a lazy chunk), quality tiers, adaptive pixel ratio, WebGL fallback, palette from CSS tokens | `modes/three/scene/*`, `lib/device.ts` |
| Reduced motion, analytics, sound toggle, game scores and leaderboards | `lib/*`, `apps/games` |

**Proposed structure**

```
modes/drive/
  index.ts            ModeViews wiring
  DriveLayout.tsx     canvas + cockpit + HUD + pause menu + route map
  engine/
    route.ts          sections → road segments (curvature, hills, checkpoint positions)   ← pure, unit-tested
    vehicle.ts        speed, steering, drift in turns, off-road slowdown, collisions      ← pure, unit-tested
    input.ts          keyboard / touch / (gamepad) → one input state
    renderer.ts       three.js: road, sky, scenery, traffic, checkpoint gates
  cockpit/            dashboard + steering wheel as SVG/CSS layers over the canvas (wheel turns, gauges move)
  checkpoints/        CheckpointPanel (reuses the Simple section components)
```

**Flow:** start screen ("Start engine", which is also the user gesture that unlocks sound) → drive → checkpoint opens → continue → … → finish line at Contact → parked end screen. Always reachable from Esc: route map, autopilot, calm mode, switch mode.

**Quality floor (not optional):** forgiving steering (no game over from walls), pause on tab blur, keyboard-only works, calm mode for `prefers-reduced-motion` (no camera shake or head-bob, slower speed), checkpoint panels trap focus like the existing drawers, a "Read as a page" exit to Simple at all times, and the same section order and visibility as every other mode.

**Integration touch-points** (every place that lists the modes today): `api/types.ts` `ModeId`, `modes/registry.ts`, `PreferencesProvider` `MODES`, `index.html` pre-paint script, `domain/resources.ts` default-mode options, Terminal `mode` command, backend `PresentationMode` choices (+ migration), docs.

**Assets.** Only CC0 or CC-BY graphics and models (for example Kenney, Quaternius, Poly Haven, OpenGameArt), each recorded with source URL and licence in `docs/CREDITS.md`. No branded or ripped game assets. Proposed total download budget: 3 MB, loaded only when Drive mode is opened.

---

## 3. Phases

### Phase 0 — Clarify & finalize
- [x] Frontend stack, sudo UX, modes, games, features, storage, security, hosting, build order
- [ ] Production media storage + domain (§5)
- [ ] Collect resume / LinkedIn content (Drive link needs sign-in, LinkedIn blocks fetching)

### Phase 1 — Backend foundation ✅
- [x] Django project scaffold, split settings, env config (`.env.example`)
- [x] Docker Compose with PostgreSQL (dev database)
- [x] `core`: abstract models, permissions (`IsOwner`), reorder, error envelope
- [x] `accounts`: password → TOTP → JWT httpOnly cookies, refresh, logout, `me`, rate limiting, `setup_totp`
- [x] drf-spectacular / Swagger (schema generates with 0 warnings)

### Phase 2 — Content apps & APIs ✅
- [x] `profiles`, `experience`, `projects`, `skills`, `site_config` models + migrations
- [x] `blog` (markdown, draft/publish/schedule)
- [x] `media_library` uploads (validation, `MediaRefField`)
- [x] `versioning`: snapshot on save, list, diff, restore
- [x] Public read-only endpoints + admin CRUD, reorder, publish/hide
- [x] Seed command (`seed_portfolio`)
- [x] Tests (73 backend tests)

### Phase 3 — Supporting apps ✅
- [x] `contact`: honeypot, throttling, inbox
- [x] `analytics`: cookie-less beacon + aggregates
- [x] `games`: registry, signed sessions, anti-cheat, leaderboards, moderation (backend only; no playable game yet)

### Phase 4 — Frontend foundation ✅ (sound pending)
- [x] Vite + TS scaffold, routing, lint, tests
- [x] Design tokens, dark/light theme, `[data-mode]` switching
- [x] Responsive layout (portrait / landscape / mobile, safe-area insets)
- [x] API client + TanStack Query, domain view-models, mode registry, ModeSwitcher, ThemeToggle
- [x] Device capability detection (WebGL, memory, save-data, reduced motion)
- [ ] SoundToggle + `useSound()` (Phase 7)

### Phase 5 — Mode skins
- [x] **Simple**: all sections, GSAP trace hero + scrubbed timeline, anime.js feedback, Lenis
- [x] **Terminal** *(authored by owner, verified: renders, 92 frontend tests pass)*: shell, parser, virtual filesystem, Tab completion, tappable chips, owner edit commands
- [x] **3D** *(authored by owner, verified: WebGL canvas renders, no console errors)*: raw three.js GPU-die world, scroll-driven camera flight, call-stack rail, readout chip, quality tiers + adaptive pixel ratio, fallback to content-only. *Differs from the original plan, which assumed React Three Fiber; raw three.js keeps the bundle lean and the engine React-free.*
- [ ] Mode-switch transitions (shared, applies to all modes)
- [ ] Blog views checked in Terminal (Simple and 3D done)
- [ ] 3D follow-ups: Warp Scheduler entry in the GPU scene (needs Phase 7), sound hooks, keyboard / screen-reader pass, real-device performance check
- [ ] **Drive** (§2.5): see Phase 5b

### Phase 5b — Drive mode *(scoped; see D16–D23)*
- [ ] D0 Clarify scope, style and assets; update §4
- [ ] D1 Engine core: `route.ts`, `vehicle.ts`, `input.ts` as pure functions with unit tests
- [ ] D2 Integration plumbing: `ModeId`, registry, preferences, `index.html`, backend `PresentationMode` + migration, Terminal `mode drive`
- [ ] D3 Renderer: road with curves and hills, sky and time-of-day tied to theme, scenery, quality tiers, WebGL fallback
- [ ] D4 Cockpit + HUD: steering wheel and gauges, speed, progress, route map, pause menu
- [ ] D5 Checkpoints: gates on the road, panels reusing Simple section components, inline edit works, focus handling
- [ ] D6 Light-racing layer: traffic, boost pads, crashes that only slow the car, optional lap timer, points score → `games` leaderboard (`road-trip`)
- [ ] D7 Controls: keyboard, touch zones, device tilt (with iOS permission prompt), on-screen pedals, gamepad; Autopilot; Esc route map; "Read as a page"
- [ ] D8 Assets (CC0 / CC-BY, low-poly) sourced; `docs/CREDITS.md` + in-app credits page
- [ ] D9 Sound (engine hum, indicators, checkpoint chime; muted by default, unlocked by "Start engine")
- [ ] D10 Calm mode, accessibility pass, performance budget check, tests, docs

### Phase 6 — Sudo mode ✅
- [x] Hidden entry (`sudo` shortcut, Terminal `sudo`, `/sudo/login`)
- [x] Login + TOTP flow, Security page
- [x] Inline editing (Simple + 3D) through `EditableSection` / `EditableItem`
- [x] Terminal edit commands (`edit`, `new`, `set`, `publish`, `hide`, `history`, `restore`)
- [x] Dashboard: content CRUD, drag-to-reorder, publish/hide, media library, resume versions
- [x] Dashboard: inbox, analytics, history + restore, site settings, section order, leaderboard moderation

### Phase 7 — Games & sound
- [ ] Shared game engine (loop, input, resize, pause, scoring)
- [ ] Pop the Bugs
- [ ] Token Snake
- [ ] Warp Scheduler
- [ ] Arcade section + placements (§2.2)
- [ ] Sound sprite sheets + `useSound()` integration

### Phase 8 — Quality & docs
- [x] `docs/ARCHITECTURE.md`, `docs/BACKEND.md`, `docs/FRONTEND.md`, READMEs *(need a refresh: they still describe Terminal and 3D as planned, and will need Drive)*
- [ ] Accessibility pass across all modes (Simple + dashboard checked; Terminal, 3D, Drive pending)
- [ ] Performance (code-split done; 3D chunk is ~583 KB / 149 KB gzip, lazy; Lighthouse pending)
- [ ] SEO (meta, OG images, sitemap; pre-render the public routes)
- [ ] TSDoc on public modules

### Phase 9 — Deployment
- [ ] Backend Dockerfile (gunicorn + whitenoise) for Render/Railway
- [ ] Managed Postgres + migrations on deploy
- [ ] Frontend on Vercel/Netlify with `/api/*` rewrite (`vercel.json` drafted)
- [ ] Production media storage (see §5)
- [ ] `docs/DEPLOY.md` (environment variables, secrets)
- [ ] CI: lint + test on push
- [ ] Backups for Postgres + media

---

## 4. Decisions Log

| # | Decision | Status |
|---|---|---|
| D1 | Frontend: **React + Vite + TypeScript** single-page app consuming the DRF API | ✅ |
| D2 | Sudo UX: **both** inline editing on the live page and a `/sudo` dashboard | ✅ |
| D3 | **Three switchable presentation modes**: Simple, Terminal, 3D, with shared data, logic and editing layers (§2.1) | ✅ |
| D4 | Visitors can switch modes; the owner sets the default (`site_config.default_mode`); a visitor's choice is remembered | ✅ |
| D5 | Inline editing: click-to-edit in **Simple + 3D**; **Terminal** edits via commands. All use the same mutation hooks | ✅ |
| D6 | 3D **auto-degrades** by device capability and falls back to Simple without WebGL | ✅ |
| D7 | Terminal: real command line **plus tappable chips** and clickable output | ✅ |
| D8 | Games: **all three** (Pop the Bugs, Token Snake, Warp Scheduler) on one shared engine, placed across the site (§2.2) + **sound design** | ✅ |
| D9 | Features: **contact inbox, blog, analytics, version history** | ✅ |
| D10 | **PostgreSQL + local media** (storage setting allows a later move to S3) | ✅ |
| D11 | Sudo auth: **password + TOTP 2FA**, JWT in httpOnly cookies, rate-limited | ✅ |
| D12 | Hosting: **split PaaS**. Frontend on Vercel/Netlify, Django + Postgres on Render/Railway. Vercel rewrites `/api/*` → backend so the browser sees one origin (no CORS, first-party cookies) | ✅ |
| D13 | Build order: **MVP first** (backend + Simple + dashboard), then Terminal, then 3D, then games & sound | ✅ |
| D14 | Game placements as proposed in §2.2 | ✅ |
| D15 | Terminal and 3D modes were authored by the owner; adopted as-is after review (92 tests, types, lint, build all pass). 3D uses raw three.js, not R3F | ✅ |
| D16 | A fourth mode, **Drive** (first-person driving through the portfolio), is added on the same mode layers (§2.5) | ✅ |
| D17 | Drive renders with **real 3D (three.js)**, sharing the lazy three chunk, quality tiers and WebGL fallback of 3D mode | ✅ |
| D18 | Gameplay is **light racing**: curves, light traffic, boost pads, optional lap timer. Crashes only slow the car; **no game over**. Score can post to the `games` leaderboard | ✅ |
| D19 | Visitors can always leave the route: **Esc → route map** (jump to any checkpoint), **Autopilot**, and **"Read as a page"** (switch to Simple) | ✅ |
| D20 | Controls: **keyboard** (arrows / WASD), **touch left-right zones** with auto-accelerate, **device tilt**, **on-screen pedals**, **gamepad** | ✅ |
| D21 | Assets: **CC0 + CC-BY only**, each logged in `docs/CREDITS.md` (source URL, licence, author) and shown on an in-app credits page. Style: **stylized low-poly** | ✅ |
| D22 | At a checkpoint the **car stops and a panel opens** (Simple section components, so inline editing and forms work); Enter drives on | ✅ |
| D23 | 3D mode is kept as-is; its shared follow-ups (mode-switch transition, sound, accessibility pass) are built once during Drive and applied to all modes | ✅ |

---

## 5. Open Questions

**Drive mode: answered** (D16–D23). Smaller points I will assume unless you say otherwise:
1. Sound is **muted by default**; the "Start engine" screen is the user gesture that lets audio play, with a speaker toggle on it.
2. Drive is **opt-in**: the owner's default mode stays Simple, and Drive is one of the four modes in the switcher. It also works as `?mode=drive`.
3. The leaderboard (if used) is a new `Game` row (`road-trip`) added by a data migration. Because the backend ranks higher scores first, the score is points (distance + boosts − crash penalties), not raw lap time.
4. Dark theme = night drive, light theme = daytime drive.
5. The car is a generic low-poly sports car, never a real brand.

**Carried over**
9. Production media storage (PaaS disks are wiped on redeploy: persistent volume or an S3-compatible bucket such as Cloudflare R2)
10. Custom domain?
11. Resume PDF + LinkedIn details (see §1)
