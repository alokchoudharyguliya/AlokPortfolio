"""Helpers that write / clear the JWT cookies on a response."""

from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken


def _common():
    cfg = settings.AUTH_COOKIES
    return {"httponly": True, "secure": cfg["SECURE"], "samesite": cfg["SAMESITE"]}


def set_auth_cookies(response, refresh: RefreshToken):
    cfg = settings.AUTH_COOKIES
    jwt = settings.SIMPLE_JWT
    response.set_cookie(
        cfg["ACCESS_NAME"],
        str(refresh.access_token),
        max_age=int(jwt["ACCESS_TOKEN_LIFETIME"].total_seconds()),
        path="/",
        **_common(),
    )
    response.set_cookie(
        cfg["REFRESH_NAME"],
        str(refresh),
        max_age=int(jwt["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        path=cfg["REFRESH_PATH"],
        **_common(),
    )
    return response


def set_rotated_cookies(response, access: str, refresh: str | None):
    """Used by /auth/refresh/, which receives raw token strings from simplejwt."""
    cfg = settings.AUTH_COOKIES
    jwt = settings.SIMPLE_JWT
    response.set_cookie(
        cfg["ACCESS_NAME"],
        access,
        max_age=int(jwt["ACCESS_TOKEN_LIFETIME"].total_seconds()),
        path="/",
        **_common(),
    )
    if refresh:
        response.set_cookie(
            cfg["REFRESH_NAME"],
            refresh,
            max_age=int(jwt["REFRESH_TOKEN_LIFETIME"].total_seconds()),
            path=cfg["REFRESH_PATH"],
            **_common(),
        )
    return response


def clear_auth_cookies(response):
    cfg = settings.AUTH_COOKIES
    response.delete_cookie(cfg["ACCESS_NAME"], path="/", samesite=cfg["SAMESITE"])
    response.delete_cookie(cfg["REFRESH_NAME"], path=cfg["REFRESH_PATH"], samesite=cfg["SAMESITE"])
    return response
