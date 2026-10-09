"""Aggregation queries for the owner dashboard."""

from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone

from .models import Event


def _counts(qs, field, limit=None):
    rows = qs.exclude(**{field: ""}).values(field).annotate(count=Count("id")).order_by("-count")
    if limit:
        rows = rows[:limit]
    return [{"key": r[field], "count": r["count"]} for r in rows]


def summary(days: int = 30) -> dict:
    since = timezone.now() - timedelta(days=days)
    events = Event.objects.filter(created_at__gte=since)
    views = events.filter(kind=Event.Kind.PAGEVIEW)

    daily_rows = (
        views.annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(views=Count("id"), visitors=Count("visitor_hash", distinct=True))
        .order_by("day")
    )
    by_day = {r["day"]: r for r in daily_rows}
    today = timezone.now().date()
    daily = []
    for offset in range(days - 1, -1, -1):
        day = today - timedelta(days=offset)
        row = by_day.get(day)
        daily.append(
            {
                "date": day.isoformat(),
                "views": row["views"] if row else 0,
                "visitors": row["visitors"] if row else 0,
            }
        )

    game_rows = (
        events.filter(kind=Event.Kind.GAME_PLAY)
        .values("props__game")
        .annotate(count=Count("id"))
        .order_by("-count")
    )

    return {
        "days": days,
        "totals": {
            "pageviews": views.count(),
            "visitors": views.values("visitor_hash").distinct().count(),
            "events": events.count(),
        },
        "daily": daily,
        "by_mode": _counts(views, "mode"),
        "by_theme": _counts(views, "theme"),
        "by_device": _counts(views, "device"),
        "top_paths": _counts(views, "path", 10),
        "top_referrers": _counts(views, "referrer", 10),
        "events_by_kind": _counts(events.exclude(kind=Event.Kind.PAGEVIEW), "kind"),
        "games": [
            {"key": r["props__game"], "count": r["count"]} for r in game_rows if r["props__game"]
        ],
    }
