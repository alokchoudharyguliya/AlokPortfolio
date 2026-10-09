"""Creates the fixed set of homepage sections and the SiteConfig row."""

from django.db import migrations

# Copied (not imported) so this migration stays stable if the model module changes.
SECTIONS = [
    ("hero", "Hello", ""),
    ("about", "About", "How I think about engineering"),
    ("focus", "Currently deepening", "Where my learning time goes right now"),
    ("experience", "Experience", "Where I've built things"),
    ("projects", "Projects", "Systems, models and the measurements behind them"),
    ("skills", "Toolbox", "From application code down to the GPU"),
    ("education", "Education", ""),
    ("achievements", "Leadership & achievements", ""),
    ("blog", "Writing", "Notes on systems, inference and performance"),
    ("arcade", "Arcade", "Take a break — systems-themed mini games"),
    ("contact", "Contact", "Let's build something fast"),
]


def seed(apps, schema_editor):
    Section = apps.get_model("site_config", "Section")
    SiteConfig = apps.get_model("site_config", "SiteConfig")
    for order, (key, title, subtitle) in enumerate(SECTIONS):
        Section.objects.get_or_create(
            key=key, defaults={"title": title, "subtitle": subtitle, "order": order}
        )
    SiteConfig.objects.get_or_create(pk=1)


def unseed(apps, schema_editor):
    apps.get_model("site_config", "Section").objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [("site_config", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]
