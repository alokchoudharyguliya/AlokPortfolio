# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Portfolio-site frontend: React 19 + Vite + TypeScript, plain CSS Modules with design tokens (no CSS framework). It is one half of a monorepo-style layout; the Django backend, `docker-compose.yml`, `plan.md` and deeper docs live in sibling directories (`../backend`, `../docs/FRONTEND.md`, `../docs/ARCHITECTURE.md`, `../docs/BACKEND.md`). This directory is not itself a git repo.

## Commands

```bash
npm install
npm run dev          # Vite on :5173 (all interfaces); needs Django on :8000
npm run build        # tsc -b && vite build
npm run typecheck    # tsc -b
npm run lint         # eslint .
npm test             # vitest run (jsdom)
npm run test:watch
npx vitest run src/domain/domain.test.ts          # single test file
npx vitest run -t "renders one lane"              # single test by name
```

- Copy `.env.example` → `.env`; `VITE_DEV_BACKEND` is where the dev server proxies `/api` and `/media` (keep `127.0.0.1` even when testing over the LAN IP).
- `vercel.json` rewrites `/api/*` and `/media/*` to the backend — `YOUR-BACKEND-HOST` is a placeholder to replace on deploy.
- Path alias `@/` → `src/`. Dependency versions in `package.json` are pinned exactly (no `^`).
- TS is strict with `noUnusedLocals`/`noUnusedParameters`; ESLint allows unused args only if prefixed `_`.

## Architecture

The key idea: **content is separated from presentation, and presentation is separated from editing.** Read `App.tsx` and `app/PublicSite.tsx` header comments first.

**Data flow:** `api/public.useBootstrap` fetches one aggregate (`Bootstrap`) → `domain/sections.buildSections` turns it into an ordered `SectionModel[]` (order/visibility come from the owner's `Section` settings) → the active mode's views render that list. Every mode renders the *same* section list; modes are skins only.

**Presentation modes** (`src/modes/`): `registry.ts` is the only place that knows which modes exist (`simple` and `terminal` are implemented; `3d` is registered with `implemented: false` and falls back to the Simple views). A mode exports a `ModeViews` object (`Layout`, `Home`, `Project`, `BlogIndex`, `Post`, `NotFound`) per the contract in `modes/types.ts`; `useModeViews` wraps each in `React.lazy` so a skin downloads only when used. Modes never fetch data or call the admin API — they receive view-models and use the shared `sudo/inline` wrappers (`EditableSection`, `EditableItem`) for editing. Mode + theme are resolved in `lib/preferences/PreferencesProvider` (URL `?mode=` → saved choice → owner's site default → fallback) and written to `<html data-mode data-theme>`; CSS tokens in `styles/tokens.css` key off those attributes. Unavailable modes fall back to `simple` without overwriting the saved choice.

**Resource registry** (`domain/resources.ts`): a declarative `ResourceDef` per owner-editable Django resource (endpoint, fields, labels, `versionResource`). One definition drives the dashboard list page, the inline edit drawer, schema-driven `ResourceForm`, and version history. Adding a serializer field = add it to `api/types.ts` and the resource's `fields`; adding a resource = a `RESOURCES` entry plus a line in `SIMPLE_COLLECTIONS` in `sudo/dashboard/DashboardRoutes.tsx`.

**Terminal mode** (`modes/terminal/`): content is exposed as a virtual filesystem (`shell/fs.ts`, rebuilt from the same `SectionModel`s) and navigated with shell commands plus tappable output. Commands are plain `Command` objects in `commands/` registered in `commands/index.ts` — they receive a hook-free `CommandContext` assembled by `shell/ShellProvider.tsx`. Owner commands (`edit set publish hide restore …`) reuse the dashboard's write path (`patchAdmin`/`restoreVersion` in `api/admin.ts`, field metadata from `domain/resources.ts`). Route views render nothing; deep links run the equivalent `cat`. Details: `../docs/FRONTEND.md` §3a.

**3D mode & exhibits** (`modes/three/`): one `SceneEngine` (GPU-die world) driven by scroll through `data-station` elements. A skill group can set `SkillCategory.exhibit` (backend choices, `domain/resources.ts` `EXHIBIT_OPTIONS` and `modes/three/exhibits/catalog.ts` must agree; a test checks the two frontend lists, the backend choices are synced by hand) to attach a pinned "dive": a tall section whose sticky panel lets scroll drive the camera down an exhibit's levels (hardware: board → package → cache → core → registers). Pure maths is in `exhibits/dive.ts`, exhibits implement `exhibits/types.ts` `Exhibit` and are registered in `exhibits/index.ts`. Without WebGL, on the low quality tier or with reduced motion the exhibit is a static list of levels. Design, authoring steps and roadmap: `../docs/EXHIBITS.md`.

**Owner ("sudo") features** (`src/sudo/`): `SudoProvider` holds `isOwner` (from `/auth/me/`), the persisted `editing` toggle, and `openEditor()`, which drives the single shared `EditorDrawer`. In edit mode `PublicSite` requests drafts via `useBootstrap(editing)` and shows empty sections. Typing `sudo` on the public site jumps to `/sudo/login` (password → TOTP). The dashboard (`/sudo/*`) is lazy-loaded so visitors never download it. Both dashboard and inline editing write through the same `useAdminMutations` hooks (`api/admin.ts`), which invalidate the admin cache **and** the public bootstrap so all modes refresh.

**API layer** (`src/api/`): `client.ts` is the only HTTP entry point — same-origin `/api/v1`, httpOnly JWT cookies (`credentials: "include"`), CSRF token on unsafe methods, one shared refresh-and-retry on 401 for `/admin/` paths (dispatches `sudo:session-expired` if refresh fails), and errors normalised to `ApiError` (`status`, `code`, `fields` for form mapping). `queryKeys.ts` is the central key factory — invalidate by these prefixes. `api/types.ts` hand-mirrors the DRF serializers; keep it in sync with the backend.

**Other things to know**
- `lib/storage.ts` is a never-throwing `localStorage` wrapper; its `KEYS` are duplicated in the pre-paint script in `index.html` — change both together.
- Heavy libs are split into manual chunks in `vite.config.ts` (`motion` = gsap+lenis, `anime`, `markdown`, `dnd`).
- Motion: one orchestrated GSAP hero timeline; everything else is scroll-scrubbed or click-driven (anime.js). All of it must honour `prefers-reduced-motion` (`lib/motion/useReducedMotion`); Lenis is off for reduced motion and touch.
- Styling uses only `var(--token)` values; the owner's accent overrides `--signal` at runtime.
- Tests are colocated (`*.test.ts(x)`) and cover domain logic, form payloads, trace hero rendering, chart ticks and the Terminal (pure shell logic, visitor UI flows, owner commands against a mocked `api`; `modes/terminal/fixtures.ts` builds a Bootstrap); `src/test/setup.ts` polyfills `matchMedia` for jsdom.
