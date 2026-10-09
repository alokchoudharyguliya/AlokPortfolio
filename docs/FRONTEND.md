# Frontend reference

React 19 + Vite + TypeScript. Plain CSS Modules with design tokens in CSS variables; no CSS framework.

## 1. Directory map

```
src/
├── main.tsx, App.tsx       Providers + top-level routes (see App.tsx header comment)
├── api/                    L2 data layer
│   ├── client.ts           fetch wrapper: cookies, CSRF, refresh-on-401, ApiError
│   ├── types.ts            TS mirrors of DRF serializers
│   ├── queryKeys.ts        cache keys; mutations invalidate by prefix
│   ├── public.ts           useBootstrap, usePosts, usePost, useSubmitContact
│   ├── auth.ts             useMe, useLogin, useVerifyOtp, useLogout, OTP setup
│   └── admin.ts            generic useAdminList / useAdminItem / useAdminMutations / useSingleton + specific hooks
├── domain/                 L3 mode-agnostic logic
│   ├── sections.ts         Bootstrap → ordered SectionModel[] (the contract every mode renders)
│   ├── resources.ts        Registry of editable resources (fields, labels, version ids)
│   └── format.ts           Dates, sizes, labels
├── lib/
│   ├── preferences/        PreferencesProvider: mode, theme, sound, site defaults, <html> attributes
│   ├── motion/             gsap.ts (plugin registration), SmoothScroll (Lenis), anime.ts presets, useReducedMotion
│   ├── analytics.ts        track() beacon
│   ├── device.ts           device class, WebGL support, quality tier (for 3D)
│   └── storage.ts          safe localStorage + keys
├── ui/                     L4 shared primitives (Button, Drawer, Toast, Icon, Markdown, ModeSwitcher, ThemeToggle, form/*)
├── modes/                  L5 presentation skins
│   ├── types.ts            ModeDefinition, ModeViews, SectionProps contracts
│   ├── registry.ts         THE list of modes (simple ✓, terminal ✓, 3d ·)
│   ├── useModeViews.ts     lazy-loads a mode's views
│   ├── simple/             Simple skin: layout, hero/TraceHero, sections/*, views.tsx
│   └── terminal/           Terminal skin: TerminalLayout, views (deep links), commands/*, shell/* (see §3a)
├── sudo/                   Owner features
│   ├── SudoProvider.tsx    isOwner, edit mode, openEditor(), `sudo` keyboard shortcut
│   ├── SudoBar.tsx         floating owner bar on the public site
│   ├── LoginPage.tsx       password → TOTP
│   ├── editor/             EditorDrawer (single shared editor) + ResourceForm (schema-driven)
│   ├── inline/             EditableSection / EditableItem / EditButton
│   ├── media/              MediaPicker, MediaGrid, UploadButton
│   └── dashboard/          DashboardLayout, DashboardRoutes, SortableList, pages/*
├── app/                    PublicSite (public shell), BootScreen
└── styles/                 tokens.css (theme × mode tokens), global.css
```

## 2. Component responsibilities and connections

| Component | Responsibility | Talks to |
|---|---|---|
| `App` | Provider tree, route split (`/sudo/login`, `/sudo/*`, `/*`) | everything below |
| `PreferencesProvider` | Resolves mode and theme, persists choices, writes `data-mode`/`data-theme`/`--signal` | `modes/registry` (availability), `lib/analytics` |
| `SudoProvider` | Owner session state, edit-mode toggle, hosts the one `EditorDrawer` | `api/auth.useMe`, `EditorDrawer` |
| `PublicSite` | Loads bootstrap (with drafts in edit mode), applies site defaults, routes to the active mode's views, counts page views | `api/public`, `domain/sections`, `useModeViews` |
| `modes/simple/*` | Renders SectionModels (hero trace, timeline, projects …) | `sudo/inline` wrappers, `lib/motion` |
| `modes/terminal/*` | The same SectionModels as a virtual filesystem driven by shell commands | `domain/sections`, `api/admin` (`patchAdmin`, `restoreVersion`), `SudoProvider.openEditor` |
| `EditableSection` / `EditableItem` | Edit affordances around any rendered content, in edit mode only | `SudoProvider.openEditor`, `useAdminMutations` |
| `EditorDrawer` | Loads the object, shows `ResourceForm`, saves / deletes | `api/admin`, `domain/resources` |
| `ResourceForm` | Renders fields from a `ResourceDef`, builds the PATCH payload, maps server errors onto fields | `ui/form/inputs`, `MediaPicker` |
| `ResourcePage` | Generic dashboard list: reorder, publish, edit, delete | `SortableList`, `EditorDrawer` |
| `DashboardLayout` | Auth guard, sidebar (sheet on phones) | `useMe`, session-expired event |

## 3. Adding things

### A new presentation mode (e.g. Terminal)

1. Create `src/modes/terminal/index.ts` exporting `ModeViews` (`Layout`, `Home`, `Project`, `BlogIndex`, `Post`, `NotFound`).
2. Render each `SectionModel` however you like. Terminal maps section keys to commands such as `ls projects` or `cat about`.
3. For editing, call `useSudo().openEditor({ resource, id })`, or the `useAdminMutations` hooks directly for command-style edits.
4. In `modes/registry.ts`, point `load` at the new module and set `implemented: true`.
5. Add mode-specific tokens under `[data-mode="terminal"]` in `styles/tokens.css`.

### 3a. Terminal mode

```
modes/terminal/
├── index.ts             ModeViews wiring
├── TerminalLayout.tsx   window chrome + the <input> (Tab, ↑/↓, Ctrl+L, Ctrl+C) + suggestion chips
├── views.tsx            route views render nothing; deep links (/projects/x, /blog/y) run the equivalent `cat`
├── commands/            navigation.tsx (ls cd pwd cat tree open) · general.tsx (help theme mode message sudo history …)
│                        owner.tsx (edit new set publish hide restore) · index.ts = the registry
└── shell/               parse.ts · fs.ts (virtual filesystem from SectionModels) · complete.ts (Tab)
                         fields.ts (`set` value coercion) · ShellProvider.tsx (state machine) · render.tsx/output.tsx (output)
```

- **Content as a filesystem.** `buildFs()` turns the owner-ordered sections into `~/about`, `~/projects/<slug>`, `~/experience/<org>`, `~/links/<platform>`, … Hidden or empty sections are skipped exactly as in Simple mode. A section name alone is a shortcut (`projects` ≙ `cat projects`, `projects foo` ≙ `cat projects/foo`).
- **Tappable output.** Every name in the output is a `<Cmd>` button that runs a command, and the chips under the transcript follow the working directory, so the whole site works without a keyboard.
- **Commands are plain objects** (`Command` in `shell/types.ts`) that receive a `CommandContext` built by `ShellProvider`; they never use hooks. To add one, write it and add it to `COMMANDS` in `commands/index.ts`. `help`, Tab completion and the owner check pick it up.
- **Owner commands** use the same write path as the dashboard: `patchAdmin` / `restoreVersion` (`api/admin.ts`) invalidate the same caches, `edit`/`new` open the shared `EditorDrawer`, and field names, types and options come from `domain/resources.ts`. They are hidden from `help` for visitors and refused client-side, but the API's `IsOwner` is the real gate. Unpublished items only appear after `sudo edit on` (which requests drafts, as the "Edit page" toggle does).
- **Prompts.** Multi-step input (`message`) uses `ctx.ask(steps, done)`; the contact POST is `submitContact` in `api/public.ts`, honeypot included.
- **Deep links.** Navigation started by the shell carries `state.fromShell`, so the route view doesn't repeat the command.
- **Analytics.** Each command reports only its name (`terminal_command`), never its arguments.

### A new editable field

1. Add it to the Django model and serializer, then run the migration.
2. Add it to `api/types.ts` and to the resource's `fields` in `domain/resources.ts`.

The dashboard form, the inline editor and History pick it up automatically.

### A new editable resource

1. Backend: a model, a serializer, a 3-line `OwnerModelViewSet`, and router registration in the app's `urls.py`.
2. Frontend: an entry in `RESOURCES`, plus one line in `DashboardRoutes`' `SIMPLE_COLLECTIONS`.

## 4. Motion and accessibility rules

- **One orchestrated moment:** the hero trace, a single GSAP timeline that plays once.
- **Everything else is driven by the visitor:**
  - the scroll playhead and timeline spine are scrubbed by scrolling;
  - anime.js presets give feedback to clicks and taps.
- **Reduced motion:** `prefers-reduced-motion` skips every animation and the trace renders in its finished state. Lenis is disabled for reduced motion and on touch devices.
- **Keyboard:**
  - focus is always visible;
  - drawers trap focus and close on Escape, and nested drawers stack;
  - drag-to-reorder supports Space plus the arrow keys.
- **Touch and layout:**
  - controls are at least 44px;
  - drawers become bottom sheets on phones;
  - layouts are checked at 1440, 390 portrait and 844×390 landscape, with no horizontal page scroll.

## 5. Theming

`styles/tokens.css` defines colour tokens per `data-theme` and type and shape tokens per `data-mode`. Components only use `var(--token)`. The owner's accent colour, set in Settings, overrides `--signal` at runtime.

Chart colours (`--chart-mark`) were checked with the dataviz palette validator against both surfaces.

## 6. Scripts

| Script | Does |
|---|---|
| `npm run dev` | Vite on :5173 (all interfaces), proxying `/api` and `/media` to Django on :8000 |
| `npm run build` | Type-check + production build (modes, dashboard, markdown and motion are separate chunks) |
| `npm test` | Vitest (domain logic, form payloads, trace rendering, chart ticks, Terminal parser / filesystem / completion / commands) |
| `npm run lint` / `typecheck` | ESLint (incl. React Compiler-era hooks rules) / tsc |
