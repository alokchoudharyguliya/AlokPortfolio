"""Local development settings."""

import socket

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = env.bool("DEBUG", default=True)
SUDO_REQUIRE_TOTP = env.bool("SUDO_REQUIRE_TOTP", default=False)

AUTH_COOKIES = {**AUTH_COOKIES, "SECURE": False}  # noqa: F405

# WhiteNoise only matters once `collectstatic` has run (production).
MIDDLEWARE = [m for m in MIDDLEWARE if m != "whitenoise.middleware.WhiteNoiseMiddleware"]  # noqa: F405

# Vite proxies /api and /media with changeOrigin=false, so Django sees the
# browser Host header. A friend opening http://<lan-ip>:5173 sends that LAN
# address, not localhost — accept any host while DEBUG is on.
if DEBUG:
    ALLOWED_HOSTS = ["*"]


def _lan_ipv4_addrs() -> list[str]:
    """Best-effort local IPv4 addresses so CSRF/CORS can trust this machine's LAN origin."""
    found: list[str] = []
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip not in found and not ip.startswith("127."):
                found.append(ip)
    except OSError:
        pass
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("8.8.8.8", 80))
            ip = probe.getsockname()[0]
        if ip not in found and not ip.startswith("127."):
            found.append(ip)
    except OSError:
        pass
    return found


_FRONTEND_PORT = env.int("FRONTEND_PORT", default=5173)
_LAN_ORIGINS = [f"http://{ip}:{_FRONTEND_PORT}" for ip in _lan_ipv4_addrs()]
_LOOPBACK_ORIGINS = [
    f"http://localhost:{_FRONTEND_PORT}",
    f"http://127.0.0.1:{_FRONTEND_PORT}",
]

CORS_ALLOWED_ORIGINS = list(
    dict.fromkeys(
        env.list("CORS_ALLOWED_ORIGINS", default=_LOOPBACK_ORIGINS) + _LAN_ORIGINS
    )
)
CSRF_TRUSTED_ORIGINS = list(
    dict.fromkeys(
        env.list("CSRF_TRUSTED_ORIGINS", default=_LOOPBACK_ORIGINS) + _LAN_ORIGINS
    )
)

# Extra safety if the LAN address is not the one we probed (second NIC, guest Wi-Fi).
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://localhost:\d+$",
    r"^http://127\.0\.0\.1:\d+$",
    r"^http://10\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$",
    r"^http://192\.168\.\d{1,3}\.\d{1,3}:\d+$",
    r"^http://172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}:\d+$",
]
