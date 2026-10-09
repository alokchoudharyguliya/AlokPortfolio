"""pytest settings: fast, isolated, deterministic."""

import tempfile

from .base import *  # noqa: F401,F403

DEBUG = False
SUDO_REQUIRE_TOTP = False
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
MEDIA_ROOT = tempfile.mkdtemp(prefix="portfolio-test-media-")
AUTH_COOKIES = {**AUTH_COOKIES, "SECURE": False}  # noqa: F405

# Generous throttles so tests that hit endpoints repeatedly do not flake;
# throttle behaviour itself is tested by overriding these per test.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_THROTTLE_RATES": {
        "auth": "1000/min",
        "contact": "1000/min",
        "analytics": "1000/min",
        "game_session": "1000/min",
        "game_score": "1000/min",
    },
}

# WhiteNoise only matters once `collectstatic` has run (production).
MIDDLEWARE = [m for m in MIDDLEWARE if m != "whitenoise.middleware.WhiteNoiseMiddleware"]  # noqa: F405

SECRET_KEY = "test-secret-key-that-is-long-enough-for-hs256-signing"
SIMPLE_JWT = {**SIMPLE_JWT, "SIGNING_KEY": SECRET_KEY}  # noqa: F405
