from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.blog.models import Post
from apps.core.models import Tag
from apps.experience.models import Achievement, Education, Experience
from apps.profiles.models import FocusArea, Profile, SocialLink
from apps.projects.models import Project
from apps.site_config import seed_data as data
from apps.site_config.models import SiteConfig
from apps.skills.models import Skill, SkillCategory


def _tags(names):
    return [Tag.objects.filter(name__iexact=n).first() or Tag.objects.create(name=n) for n in names]


class Command(BaseCommand):
    help = "Load the initial portfolio content (idempotent; use --force to wipe and reload)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Delete existing content rows (not media, messages or analytics) and reseed.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if Project.objects.exists() and not options["force"]:
            self.stdout.write(
                self.style.WARNING("Content already present — skipping (use --force).")
            )
            return

        if options["force"]:
            for model in (
                SocialLink,
                FocusArea,
                Experience,
                Education,
                Achievement,
                Project,
                Skill,
                SkillCategory,
                Post,
            ):
                model.objects.all().delete()

        profile = Profile.load()
        for key, value in data.PROFILE.items():
            setattr(profile, key, value)
        profile.save()

        site = SiteConfig.load()
        for key, value in data.SITE.items():
            setattr(site, key, value)
        site.save()

        for order, (platform, label, url) in enumerate(data.SOCIAL_LINKS):
            SocialLink.objects.create(platform=platform, label=label, url=url, order=order)

        for order, (title, description, icon, items) in enumerate(data.FOCUS_AREAS):
            FocusArea.objects.create(
                title=title, description=description, icon=icon, items=items, order=order
            )

        for order, row in enumerate(data.EXPERIENCE):
            row = dict(row)
            tags = row.pop("tags", [])
            exp = Experience.objects.create(order=order, **row)
            exp.tags.set(_tags(tags))

        for order, row in enumerate(data.EDUCATION):
            Education.objects.create(order=order, **row)

        for order, row in enumerate(data.ACHIEVEMENTS):
            row = dict(row)
            if row.get("date"):
                row["date"] = date.fromisoformat(row["date"])
            Achievement.objects.create(order=order, **row)

        for order, row in enumerate(data.PROJECTS):
            row = dict(row)
            tags = row.pop("tags", [])
            project = Project.objects.create(order=order, **row)
            project.tags.set(_tags(tags))

        for c_order, (name, icon, skills) in enumerate(data.SKILLS):
            category = SkillCategory.objects.create(name=name, icon=icon, order=c_order)
            for s_order, skill in enumerate(skills):
                Skill.objects.create(
                    category=category,
                    name=skill,
                    order=s_order,
                    is_highlighted=skill in data.HIGHLIGHTED_SKILLS,
                )

        post_data = dict(data.DRAFT_POST)
        tags = post_data.pop("tags")
        post = Post.objects.create(is_published=False, **post_data)
        post.tags.set(_tags(tags))

        self.stdout.write(self.style.SUCCESS("Portfolio content seeded."))
