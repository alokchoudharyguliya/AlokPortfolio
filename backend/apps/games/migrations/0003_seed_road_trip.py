"""Registers the Drive-mode leaderboard (the game itself lives in the frontend's Drive mode)."""

from django.db import migrations


def seed(apps, schema_editor):
    Game = apps.get_model("games", "Game")
    # Score is points (distance, boosts, overtakes minus crashes), so the plausibility rate is
    # points per second: ~6 km at 0.1/m over ~4 minutes plus boosts and overtakes stays well below it.
    Game.objects.update_or_create(
        slug="road-trip",
        defaults={
            "name": "Road Trip",
            "description": "Drive through the portfolio. Points for distance, boosts and overtakes.",
            "max_score_rate": 40.0,
            "order": 3,
        },
    )


def unseed(apps, schema_editor):
    apps.get_model("games", "Game").objects.filter(slug="road-trip").delete()


class Migration(migrations.Migration):
    dependencies = [("games", "0002_seed_games")]
    operations = [migrations.RunPython(seed, unseed)]
