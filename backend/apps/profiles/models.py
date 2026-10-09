from django.db import models, transaction

from apps.core.models import OrderableModel, PublishableModel, SingletonModel, TimeStampedModel
from apps.media_library.models import MediaAsset


class Profile(SingletonModel, TimeStampedModel):
    full_name = models.CharField(max_length=120, default="Your Name")
    headline = models.CharField(max_length=200, blank=True)
    tagline = models.CharField(max_length=300, blank=True, help_text="One-liner under the name")
    roles = models.JSONField(
        default=list, blank=True, help_text="Rotating role titles for the hero animation"
    )
    journey = models.JSONField(
        default=list,
        blank=True,
        help_text="Ordered career stages, drawn as the hero's profiler-style trace",
    )
    bio = models.TextField(blank=True, help_text="Short plain-text bio (2-3 sentences)")
    about = models.TextField(blank=True, help_text="Markdown")
    philosophy = models.TextField(blank=True, help_text="Markdown: engineering philosophy")
    location = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    availability = models.CharField(max_length=200, blank=True, help_text="e.g. Open to SDE roles")
    is_available = models.BooleanField(default=True)
    avatar = models.ForeignKey(
        MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    def __str__(self):
        return self.full_name


class SocialLink(OrderableModel, PublishableModel, TimeStampedModel):
    class Platform(models.TextChoices):
        GITHUB = "github", "GitHub"
        LINKEDIN = "linkedin", "LinkedIn"
        X = "x", "X / Twitter"
        EMAIL = "email", "Email"
        WEBSITE = "website", "Website"
        LEETCODE = "leetcode", "LeetCode"
        KAGGLE = "kaggle", "Kaggle"
        MEDIUM = "medium", "Medium"
        OTHER = "other", "Other"

    platform = models.CharField(max_length=20, choices=Platform.choices, default=Platform.OTHER)
    label = models.CharField(max_length=80)
    url = models.CharField(max_length=500, help_text="https://… or mailto:…")

    class Meta(OrderableModel.Meta):
        pass

    def __str__(self):
        return self.label


class FocusArea(OrderableModel, PublishableModel, TimeStampedModel):
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=40, blank=True, help_text="Icon key used by the frontend")
    items = models.JSONField(default=list, blank=True)

    class Meta(OrderableModel.Meta):
        pass

    def __str__(self):
        return self.title


class ResumeVersion(TimeStampedModel):
    label = models.CharField(max_length=120, help_text="e.g. 'AI Systems — Oct 2026'")
    asset = models.ForeignKey(MediaAsset, null=True, on_delete=models.SET_NULL, related_name="+")
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.label

    def save(self, *args, **kwargs):
        with transaction.atomic():
            if self.is_active:
                ResumeVersion.objects.exclude(pk=self.pk).update(is_active=False)
            super().save(*args, **kwargs)

    @classmethod
    def active(cls):
        return (
            cls.objects.filter(is_active=True, asset__isnull=False).select_related("asset").first()
        )
