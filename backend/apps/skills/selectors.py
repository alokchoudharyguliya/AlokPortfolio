from django.db.models import Prefetch

from .models import Skill, SkillCategory


def published_categories():
    """Published categories with only their published skills attached as `published_skills`."""
    return SkillCategory.objects.published().prefetch_related(
        Prefetch("skills", queryset=Skill.objects.published(), to_attr="published_skills")
    )
