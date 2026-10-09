from django.db import models

from apps.core.models import OrderableModel, PublishableModel, Tag, TimeStampedModel
from apps.media_library.models import MediaAsset


class Experience(OrderableModel, PublishableModel, TimeStampedModel):
    class EmploymentType(models.TextChoices):
        FULL_TIME = "full_time", "Full-time"
        PART_TIME = "part_time", "Part-time"
        INTERNSHIP = "internship", "Internship"
        CONTRACT = "contract", "Contract"
        FREELANCE = "freelance", "Freelance"
        RESEARCH = "research", "Research"

    role = models.CharField(max_length=150)
    organization = models.CharField(max_length=150)
    organization_url = models.URLField(blank=True)
    logo = models.ForeignKey(
        MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    employment_type = models.CharField(
        max_length=20, choices=EmploymentType.choices, default=EmploymentType.FULL_TIME
    )
    location = models.CharField(max_length=120, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True, help_text="Empty = present")
    summary = models.TextField(blank=True)
    highlights = models.JSONField(default=list, blank=True)
    tags = models.ManyToManyField(Tag, blank=True, related_name="experiences")

    class Meta(OrderableModel.Meta):
        pass

    def __str__(self):
        return f"{self.role} @ {self.organization}"


class Education(OrderableModel, PublishableModel, TimeStampedModel):
    institution = models.CharField(max_length=200)
    degree = models.CharField(max_length=150)
    field_of_study = models.CharField(max_length=150, blank=True)
    location = models.CharField(max_length=120, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    grade = models.CharField(max_length=60, blank=True, help_text="e.g. CPI 8.5/10")
    description = models.TextField(blank=True)
    highlights = models.JSONField(default=list, blank=True)

    class Meta(OrderableModel.Meta):
        verbose_name_plural = "education"

    def __str__(self):
        return f"{self.degree}, {self.institution}"


class Achievement(OrderableModel, PublishableModel, TimeStampedModel):
    class Kind(models.TextChoices):
        LEADERSHIP = "leadership", "Leadership"
        HACKATHON = "hackathon", "Hackathon"
        AWARD = "award", "Award"
        CERTIFICATION = "certification", "Certification"
        COMMUNITY = "community", "Community"
        OTHER = "other", "Other"

    title = models.CharField(max_length=200)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.OTHER)
    organization = models.CharField(max_length=150, blank=True)
    date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    highlights = models.JSONField(default=list, blank=True)
    url = models.URLField(blank=True)

    class Meta(OrderableModel.Meta):
        pass

    def __str__(self):
        return self.title
