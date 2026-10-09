# Portfolio platform

Personal portfolio for **Alok Choudhary** with two access levels and switchable presentation modes.

- **Viewer**: the public site. Visitors can switch between Simple, Terminal and 3D modes, pick a dark or light theme, and send a message.
- **Sudo**: the owner's tools. Edit content in place on the live page, or use the `/sudo` dashboard for content, media, inbox, analytics, version history, games and security.

| Part | Stack | Docs |
|---|---|---|
| `backend/` | Django 5.2, Django REST Framework, PostgreSQL, JWT in httpOnly cookies, TOTP 2FA | [backend/README.md](backend/README.md), [docs/BACKEND.md](docs/BACKEND.md) |
| `frontend/` | React 19, Vite, TypeScript, TanStack Query, GSAP, anime.js, Lenis, dnd-kit | [frontend/README.md](frontend/README.md), [docs/FRONTEND.md](docs/FRONTEND.md) |
| Architecture | How the pieces connect | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Plan | Progress checklist and decisions | [plan.md](plan.md) |

## Quick start (local)

Prerequisites: Python 3.11+, Node 22+, PostgreSQL 14+ (local install, or `docker compose up -d db`).

```bash
# 1. Backend
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements/dev.txt   # or: uv venv && uv pip install -r requirements/dev.txt
cp .env.example .env                       # adjust DATABASE_URL if needed
createdb portfolio                         # skip when using docker compose
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_portfolio  # loads the profile content
.venv/bin/python manage.py createsuperuser # this account is the site owner
.venv/bin/python manage.py runserver       # stays on this machine; Vite proxies to it

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                                # http://localhost:5173
```

Vite listens on every interface. On your machine use `http://localhost:5173`; a friend on the same Wi-Fi should use the **Network** URL Vite prints (`http://<your-lan-ip>:5173`), not Django's `:8000`.

Vite proxies `/api` and `/media` to Django, so the browser sees a single origin. Production gets the same setup from the Vercel rewrite.

**To reach sudo mode:** open `/sudo/login`, or type `sudo` anywhere on the public site.

## Checks

```bash
cd backend  && .venv/bin/pytest && .venv/bin/ruff check .
cd frontend && npm run typecheck && npm run lint && npm test && npm run build
```
