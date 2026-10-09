# Backend (Django REST API)

See [docs/BACKEND.md](../docs/BACKEND.md) for the full reference: apps, models, endpoints and mechanisms.

## Setup

```bash
python -m venv .venv && .venv/bin/pip install -r requirements/dev.txt
cp .env.example .env
createdb portfolio            # or: docker compose up -d db (from the repo root)
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_portfolio
.venv/bin/python manage.py createsuperuser
.venv/bin/python manage.py runserver
```

- API docs: http://127.0.0.1:8000/api/docs/
- Django admin (fallback): http://127.0.0.1:8000/django-admin/

## Two-factor login

- **Development:** `SUDO_REQUIRE_TOTP` defaults to `False`, so a password alone is enough. Turn 2FA on from the dashboard (Security page).
- **Production:** it defaults to `True`. Before the first login, create the device from the server shell:

```bash
python manage.py setup_totp <username>   # prints the secret / otpauth URL
```

## Tests and lint

```bash
.venv/bin/pytest
.venv/bin/ruff check . && .venv/bin/ruff format --check .
```
