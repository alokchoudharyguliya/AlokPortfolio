"""
Base settings shared by every environment.

All environment-dependent values are read through django-environ so the same
code runs locally, in CI and on the PaaS host. See `.env.example` for the
complete list of variables.
"""

from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY", default="dev-insecure-secret-key-change-me-0123456789abcdef")
DEBUG = env.bool("DEBUG", default=False)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "drf_spectacular",
    "corsheaders",
    "django_otp",
    "django_otp.plugins.otp_totp",
]

# Order matters only for readability: foundational apps first, then content,
# then supporting/aggregating apps. See docs/BACKEND.md for the dependency map.
LOCAL_APPS = [
    "apps.core",
    "apps.accounts",
    "apps.media_library",
    "apps.versioning",
    "apps.profiles",
    "apps.experience",
    "apps.projects",
    "apps.skills",
    "apps.blog",
    "apps.contact",
    "apps.analytics",
    "apps.games",
    "apps.site_config",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django_otp.middleware.OTPMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DATABASES = {
    "default": env.db("DATABASE_URL", default="postgres://localhost:5432/portfolio"),
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# I18N
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static & media
# ---------------------------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = Path(env("MEDIA_ROOT", default=str(BASE_DIR / "media")))

# When true, Django serves MEDIA_URL itself. Required when media lives on a
# local or persistent disk (Render disk / Railway volume). Not needed with S3.
SERVE_MEDIA = env.bool("SERVE_MEDIA", default=True)

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

# Optional S3-compatible storage (Cloudflare R2 / AWS S3). Activated simply by
# providing a bucket name, so switching storage requires no code change.
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default="")
if AWS_STORAGE_BUCKET_NAME:
    STORAGES["default"] = {"BACKEND": "storages.backends.s3.S3Storage"}
    AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default="")
    AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default="")
    AWS_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL", default=None) or None
    AWS_S3_CUSTOM_DOMAIN = env("AWS_S3_CUSTOM_DOMAIN", default=None) or None
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = False
    AWS_S3_FILE_OVERWRITE = False
    SERVE_MEDIA = False

# Upload limits enforced by apps.media_library
MEDIA_MAX_UPLOAD_BYTES = env.int("MEDIA_MAX_UPLOAD_BYTES", default=10 * 1024 * 1024)
DATA_UPLOAD_MAX_MEMORY_SIZE = MEDIA_MAX_UPLOAD_BYTES + 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.accounts.authentication.CookieJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
        "rest_framework.parsers.FormParser",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [],
    # Scoped throttles are attached per-view via `throttle_scope`.
    "DEFAULT_THROTTLE_RATES": {
        "auth": "10/min",
        "contact": "5/hour",
        "analytics": "240/min",
        "game_session": "60/hour",
        "game_score": "30/hour",
    },
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Portfolio API",
    "DESCRIPTION": (
        "Public (viewer) and owner-only (sudo) endpoints for the portfolio platform. "
        "Public endpoints live under /api/v1/public/, owner endpoints under /api/v1/admin/."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

# ---------------------------------------------------------------------------
# Auth: JWT stored in httpOnly cookies (see apps/accounts)
# ---------------------------------------------------------------------------
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

AUTH_COOKIES = {
    "ACCESS_NAME": "sudo_access",
    "REFRESH_NAME": "sudo_refresh",
    # Refresh cookie is only sent to the auth endpoints, reducing exposure.
    "REFRESH_PATH": "/api/v1/auth/",
    "SECURE": env.bool("AUTH_COOKIE_SECURE", default=not DEBUG),
    "SAMESITE": "Lax",
}

# Require a TOTP code after the password step. Enforced in apps.accounts.
SUDO_REQUIRE_TOTP = env.bool("SUDO_REQUIRE_TOTP", default=True)
# Lifetime (seconds) of the signed challenge between password and TOTP steps.
SUDO_OTP_CHALLENGE_MAX_AGE = 300
OTP_TOTP_ISSUER = env("OTP_TOTP_ISSUER", default="Portfolio Sudo")

# ---------------------------------------------------------------------------
# CORS / CSRF
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])
# The SPA reads this cookie and echoes it in the X-CSRFToken header.
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "Lax"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"simple": {"format": "[{levelname}] {name}: {message}", "style": "{"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "simple"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
