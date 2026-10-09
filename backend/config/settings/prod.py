"""Production settings (Render / Railway behind the Vercel /api rewrite)."""

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False
SUDO_REQUIRE_TOTP = env.bool("SUDO_REQUIRE_TOTP", default=True)

# The PaaS terminates TLS and forwards the original scheme.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=60 * 60 * 24 * 30)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
USE_X_FORWARDED_HOST = True

STORAGES = {
    **STORAGES,  # noqa: F405
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

AUTH_COOKIES = {**AUTH_COOKIES, "SECURE": True}  # noqa: F405
