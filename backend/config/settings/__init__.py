"""
Split settings.

- base.py  — everything shared; reads configuration from the environment.
- dev.py   — local development (DEBUG, permissive CORS, no TOTP requirement by default).
- test.py  — pytest (fast password hasher, in-memory-ish media dir, throttles relaxed).
- prod.py  — production hardening (secure cookies, HSTS, whitenoise, optional S3 media).
"""
