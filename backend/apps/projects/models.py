from django.db import models

from apps.core.models import (
    OrderableModel,
    PublishableModel,
    Tag,
    TimeStampedModel,
    unique_slugify,
)
from apps.media_library.models import MediaAsset


class Project(OrderableModel, PublishableModel, TimeStampedModel):
    class Status(models.TextChoices):
        COMPLETED = "completed", "Completed"
        IN_PROGRESS = "in_progress", "In progress"
        ARCHIVED = "archived", "Archived"

    class Category(models.TextChoices):
        AI_SYSTEMS = "ai_systems", "AI systems / inference"
        ML = "ml", "Machine learning / CV"
        LLM = "llm", "LLM / RAG / agents"
        SYSTEMS = "systems", "Systems / C++"
        BACKEND = "backend", "Backend"
        FULLSTACK = "fullstack", "Full-stack"
        MOBILE = "mobile", "Mobile"
        OTHER = "other", "Other"

    title = models.CharField(max_length=150)
    slug = models.SlugField(max_length=80, unique=True, blank=True)
    summary = models.CharField(max_length=300, blank=True)
    description = models.TextField(blank=True, help_text="Markdown case study")
    role = models.CharField(max_length=120, blank=True)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.COMPLETED)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    repo_url = models.URLField(blank=True)
    demo_url = models.URLField(blank=True)
    cover = models.ForeignKey(
        MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    gallery = models.JSONField(default=list, blank=True, help_text="Ordered MediaAsset ids")
    highlights = models.JSONField(default=list, blank=True)
    metrics = models.JSONField(default=list, blank=True)
    tags = models.ManyToManyField(Tag, blank=True, related_name="projects")
    is_featured = models.BooleanField(default=False)

    class Meta(OrderableModel.Meta):
        pass

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slugify(self, self.title)
        super().save(*args, **kwargs)
