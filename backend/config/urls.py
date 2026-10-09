"""
Root URL configuration.

    /api/v1/public/...   read-only + visitor actions (contact, analytics, scores)
    /api/v1/admin/...    owner-only (IsOwner) management API
    /api/v1/auth/...     sudo login / 2FA / session
    /api/schema/, /api/docs/   OpenAPI schema + Swagger UI
    /django-admin/       Django's built-in admin (fallback tool for the owner)

Each app exposes `public_urlpatterns` and `admin_urlpatterns` in its urls.py;
they are mounted here so the app list below doubles as an API table of contents.
"""

from importlib import import_module

from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

API_APPS = [
    "core",
    "media_library",
    "versioning",
    "profiles",
    "experience",
    "projects",
    "skills",
    "blog",
    "contact",
    "analytics",
    "games",
    "site_config",
]


def _collect(attr: str):
    patterns = []
    for app in API_APPS:
        patterns += getattr(import_module(f"apps.{app}.urls"), attr)
    return patterns


urlpatterns = [
    path("api/v1/public/", include(_collect("public_urlpatterns"))),
    path("api/v1/admin/", include(_collect("admin_urlpatterns"))),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("django-admin/", admin.site.urls),
]

if settings.SERVE_MEDIA:
    prefix = settings.MEDIA_URL.lstrip("/")
    urlpatterns += [
        re_path(rf"^{prefix}(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
    ]
