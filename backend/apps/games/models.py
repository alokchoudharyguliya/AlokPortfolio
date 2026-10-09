from django.db import models

from apps.core.models import OrderableModel, TimeStampedModel


class Game(OrderableModel, TimeStampedModel):
    slug = models.SlugField(max_length=40, unique=True)
    name = models.CharField(max_length=80)
    description = models.CharField(max_length=300, blank=True)
    is_enabled = models.BooleanField(default=True)
    max_score_rate = models.FloatField(
        default=50.0, help_text="Upper bound of points per second used to reject impossible scores"
    )

    class Meta(OrderableModel.Meta):
        pass

    def __str__(self):
        return self.name


class Score(models.Model):
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="scores")
    nickname = models.CharField(max_length=24)
    score = models.PositiveIntegerField()
    duration_ms = models.PositiveIntegerField(default=0)
    session_nonce = models.CharField(max_length=32, unique=True)
    visitor_hash = models.CharField(max_length=64, blank=True)
    is_hidden = models.BooleanField(default=False, help_text="Hidden by the owner (moderation)")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-score", "created_at"]
        indexes = [models.Index(fields=["game", "-score"])]

    def __str__(self):
        return f"{self.nickname}: {self.score} ({self.game.slug})"
