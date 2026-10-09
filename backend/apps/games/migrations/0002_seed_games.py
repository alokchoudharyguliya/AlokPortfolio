"""Registers the three built-in games (the frontend ships their implementations)."""

from django.db import migrations

GAMES = [
    (
        "pop-the-bugs",
        "Pop the Bugs",
        "Bugs and cache misses float up toward prod — pop them before they ship.",
        40.0,
    ),
    (
        "token-snake",
        "Token Snake",
        "Eat tokens, grow your KV cache, and don't run out of memory.",
        15.0,
    ),
    (
        "warp-scheduler",
        "Warp Scheduler",
        "Assign GPU warps to SMs before the latency deadline hits.",
        30.0,
    ),
]


def seed(apps, schema_editor):
    Game = apps.get_model("games", "Game")
    for order, (slug, name, description, rate) in enumerate(GAMES):
        Game.objects.update_or_create(
            slug=slug,
            defaults={
                "name": name,
                "description": description,
                "max_score_rate": rate,
                "order": order,
            },
        )


def unseed(apps, schema_editor):
    apps.get_model("games", "Game").objects.filter(slug__in=[g[0] for g in GAMES]).delete()


class Migration(migrations.Migration):
    dependencies = [("games", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]
