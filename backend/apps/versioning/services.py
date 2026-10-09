"""
Snapshot, diff and restore logic. Kept free of HTTP concerns so it can be used
from viewsets, management commands and tests alike.
"""

import json

from django.contrib.contenttypes.models import ContentType
from django.core import serializers
from django.db import models, transaction

from .models import Version


def snapshot(instance) -> dict:
    """Return the JSON-safe field dict for `instance` (M2M as lists of pks)."""
    data = json.loads(serializers.serialize("json", [instance]))[0]
    return data["fields"]


def record(instance, action: str, user=None) -> Version:
    """Persist a Version for `instance`. Call after the write (and M2M) completed."""
    return Version.objects.create(
        content_type=ContentType.objects.get_for_model(instance, for_concrete_model=True),
        object_id=str(instance.pk),
        object_repr=str(instance)[:200],
        action=action,
        snapshot=snapshot(instance),
        user=user if getattr(user, "is_authenticated", False) else None,
    )


def previous(version: Version) -> Version | None:
    """The version recorded just before `version` for the same object, if any."""
    return (
        Version.objects.filter(content_type=version.content_type, object_id=version.object_id)
        .filter(
            models.Q(created_at__lt=version.created_at)
            | models.Q(created_at=version.created_at, pk__lt=version.pk)
        )
        .order_by("-created_at", "-id")
        .first()
    )


def diff(before: dict | None, after: dict) -> list[dict]:
    """Field-level changes between two snapshots (`before=None` → everything is new)."""
    before = before or {}
    changes = []
    for field in sorted(set(before) | set(after)):
        if field in ("updated_at", "created_at"):
            continue
        old, new = before.get(field), after.get(field)
        if old != new:
            changes.append({"field": field, "before": old, "after": new})
    return changes


@transaction.atomic
def restore(version: Version, user=None):
    """
    Write `version.snapshot` back to the database (re-creating the row if it was
    deleted). References to rows that no longer exist (e.g. a deleted media
    asset) are dropped instead of failing the restore.
    """
    model = version.content_type.model_class()
    fields = _drop_dangling_references(model, dict(version.snapshot))
    payload = json.dumps(
        [{"model": version.resource, "pk": _coerce_pk(model, version.object_id), "fields": fields}]
    )
    restored = None
    for deserialized in serializers.deserialize("json", payload):
        deserialized.save()
        restored = deserialized.object
    restored.refresh_from_db()
    record(restored, Version.Action.RESTORE, user)
    return restored


def _coerce_pk(model, raw):
    return int(raw) if isinstance(model._meta.pk, models.AutoField | models.BigAutoField) else raw


def _drop_dangling_references(model, fields: dict) -> dict:
    for field in model._meta.get_fields():
        name = getattr(field, "name", None)
        if name not in fields or fields[name] is None:
            continue
        if isinstance(field, models.ForeignKey):
            if not field.related_model.objects.filter(pk=fields[name]).exists():
                fields[name] = None
        elif isinstance(field, models.ManyToManyField):
            existing = set(
                field.related_model.objects.filter(pk__in=fields[name]).values_list("pk", flat=True)
            )
            fields[name] = [pk for pk in fields[name] if pk in existing]
    return fields
