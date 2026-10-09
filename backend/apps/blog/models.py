import math
import re

from django.db import models
from django.utils import timezone

from apps.core.models import (
    PublishableModel,
    PublishableQuerySet,
    Tag,
    TimeStampedModel,
    unique_slugify,
)
from apps.media_library.models import MediaAsset

WORDS_PER_MINUTE = 220


class PostQuerySet(PublishableQuerySet):
    def live(self):
        """Published and not scheduled for the future."""
        return self.filter(is_published=True, published_at__lte=timezone.now())


class Post(PublishableModel, TimeStampedModel):
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=80, unique=True, blank=True)
    excerpt = models.CharField(max_length=400, blank=True)
    body = models.TextField(blank=True, help_text="Markdown")
    cover = models.ForeignKey(
        MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    tags = models.ManyToManyField(Tag, blank=True, related_name="posts")
    is_featured = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True, db_index=True)

    # Posts default to draft, unlike other content.
    is_published = models.BooleanField(default=False, db_index=True)

    objects = PostQuerySet.as_manager()

    class Meta:
        ordering = ["-published_at", "-created_at"]

    def __str__(self):
        return self.title

    @property
    def reading_minutes(self) -> int:
        words = len(re.findall(r"\w+", self.body or ""))
        return max(1, math.ceil(words / WORDS_PER_MINUTE))

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slugify(self, self.title)
        if self.is_published and self.published_at is None:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)
