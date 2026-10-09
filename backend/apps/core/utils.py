"""Small request helpers shared by contact, analytics and games."""

import hashlib
from datetime import date

from django.conf import settings


def client_ip(request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def visitor_hash(request, *, daily: bool = True) -> str:
    """
    Privacy-friendly visitor fingerprint: sha256(ip + user-agent + secret [+ day]).

    The raw IP is never stored. With `daily=True` the hash rotates every day, so
    visitors cannot be tracked across days (same approach as Plausible et al.).
    """
    ua = request.META.get("HTTP_USER_AGENT", "")
    salt = settings.SECRET_KEY + (date.today().isoformat() if daily else "")
    raw = f"{client_ip(request)}|{ua}|{salt}".encode()
    return hashlib.sha256(raw).hexdigest()[:32]
