from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.core.models import OrderableModel, PublishableModel, TimeStampedModel


class SkillCategory(OrderableModel, PublishableModel, TimeStampedModel):
    # Keep in sync with EXHIBITS in frontend/src/modes/three/exhibits/catalog.ts.
    EXHIBIT_CHOICES = [
        ("hardware", "Hardware: motherboard to registers"),
        ("cuda", "CUDA: GPU to a single thread"),
        ("transformer", "Transformer: stack to softmax"),
    ]

    name = models.CharField(max_length=80, unique=True)
    description = models.CharField(max_length=300, blank=True)
    icon = models.CharField(max_length=40, blank=True, help_text="Icon key used by the frontend")
    exhibit = models.CharField(
        max_length=24,
        blank=True,
        choices=EXHIBIT_CHOICES,
        help_text="Optional 3D-mode exhibit this group links to (a scroll-driven zoom through the topic)",
    )

    class Meta(OrderableModel.Meta):
        verbose_name_plural = "skill categories"

    def __str__(self):
        return self.name


class Skill(OrderableModel, PublishableModel, TimeStampedModel):
    category = models.ForeignKey(SkillCategory, on_delete=models.CASCADE, related_name="skills")
    name = models.CharField(max_length=80)
    level = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Optional 1-5 self-assessment",
    )
    is_highlighted = models.BooleanField(default=False)

    class Meta(OrderableModel.Meta):
        constraints = [
            models.UniqueConstraint(fields=["category", "name"], name="unique_skill_per_category")
        ]

    def __str__(self):
        return self.name
