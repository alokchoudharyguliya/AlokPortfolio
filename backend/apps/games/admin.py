from django.contrib import admin

from .models import Game, Score


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "is_enabled", "max_score_rate", "order"]
    list_editable = ["is_enabled", "max_score_rate"]


@admin.register(Score)
class ScoreAdmin(admin.ModelAdmin):
    list_display = ["nickname", "game", "score", "is_hidden", "created_at"]
    list_filter = ["game", "is_hidden"]
