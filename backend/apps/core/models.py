"""
Reusable abstract models and the shared Tag taxonomy.

Content models compose these mixins instead of re-declaring common fields,
which keeps serializers, admin viewsets and the frontend's generic resource
editor uniform: every orderable resource has `order`, every publishable
resource has `is_published`, and so on.
"""

from django.db import models
from django.utils.text import slugify


class TimeStampedModel(models.Model):
    """Adds `created_at` / `updated_at` audit timestamps."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class OrderableModel(models.Model):
    """
    Manual ordering controlled from the sudo dashboard (drag & drop).

    The admin `reorder` action rewrites `order` for a list of ids in one call.
    """

    order = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        abstract = True
        ordering = ["order", "id"]


class PublishableQuerySet(models.QuerySet):
    def published(self):
        return self.filter(is_published=True)


class PublishableModel(models.Model):
    """
    Visibility toggle. Public endpoints only ever return published rows;
    the owner sees everything through the admin endpoints.
    """

    is_published = models.BooleanField(default=True, db_index=True)

    objects = PublishableQuerySet.as_manager()

    class Meta:
        abstract = True


class SingletonModel(models.Model):
    """
    A table that always holds exactly one row (pk=1), e.g. Profile, SiteConfig.

    Use `Model.load()` instead of `objects.get()`; it creates the row on first
    access so the API never 404s on a fresh database.
    """

    singleton_pk = 1

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.pk = self.singleton_pk
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):  # pragma: no cover - deliberately inert
        raise RuntimeError(f"{type(self).__name__} is a singleton and cannot be deleted.")

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=cls.singleton_pk)
        return obj


class Tag(models.Model):
    """
    Free-form label shared across apps (project tech stack, experience tech,
    blog topics). Created on the fly by `TagNamesField` when the owner types a
    new tag name in the editor.
    """

    name = models.CharField(max_length=60, unique=True)
    slug = models.SlugField(max_length=70, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:70] or f"tag-{self.pk or ''}"
        super().save(*args, **kwargs)


def unique_slugify(instance, value: str, slug_field: str = "slug", max_length: int = 80) -> str:
    """Return a slug derived from `value` that is unique for the instance's model."""
    base = slugify(value)[: max_length - 5] or "item"
    slug = base
    model = type(instance)
    n = 2
    while model.objects.filter(**{slug_field: slug}).exclude(pk=instance.pk).exists():
        slug = f"{base}-{n}"
        n += 1
    return slug
