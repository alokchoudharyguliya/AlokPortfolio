# Frontend (React + Vite + TypeScript)

See [docs/FRONTEND.md](../docs/FRONTEND.md) for the component map, responsibilities and how to add modes, fields and resources.

```bash
npm install
npm run dev        # http://localhost:5173 and http://<lan-ip>:5173 (Django must run on :8000)
npm test
npm run build
```

- **Routes:** `/` (home), `/projects/:slug`, `/blog`, `/blog/:slug`, `/sudo/login`, `/sudo/*` (dashboard).
- **Modes:** `?mode=simple|terminal` (3D is still to come). Terminal: type `help`, or tap the suggestion chips.
- **Owner shortcut:** type `sudo` anywhere on the public site, or `sudo login` in Terminal mode.
- **Deployment:** `vercel.json` rewrites `/api/*` and `/media/*` to the backend. Replace `YOUR-BACKEND-HOST`.
