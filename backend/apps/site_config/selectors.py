"""Builds the homepage aggregate. Two variants: public (published only) and owner drafts."""

from django.db.models import Prefetch

from apps.blog.models import Post
from apps.blog.serializers import PostListSerializer
from apps.experience.models import Achievement, Education, Experience
from apps.experience.serializers import (
    AchievementSerializer,
    EducationSerializer,
    ExperienceSerializer,
)
from apps.games.models import Game
from apps.games.serializers import PublicGameSerializer
from apps.profiles.models import FocusArea, Profile, ResumeVersion, SocialLink
from apps.profiles.serializers import (
    FocusAreaSerializer,
    ProfileSerializer,
    SocialLinkSerializer,
)
from apps.projects.models import Project
from apps.projects.serializers import ProjectSerializer
from apps.skills.models import Skill, SkillCategory
from apps.skills.selectors import published_categories
from apps.skills.serializers import PublicSkillCategorySerializer

from .models import Section, SiteConfig
from .serializers import SectionSerializer, SiteConfigSerializer

RECENT_POSTS = 3


def _scope(qs, drafts: bool):
    return qs if drafts else qs.published()


def build_bootstrap(drafts: bool = False) -> dict:
    site = SiteConfig.load()
    sections = Section.objects.all() if drafts else Section.objects.filter(is_visible=True)

    if drafts:
        skills = SkillCategory.objects.prefetch_related(
            Prefetch("skills", queryset=Skill.objects.all(), to_attr="published_skills")
        )
        posts = Post.objects.all()
    else:
        skills = published_categories()
        posts = Post.objects.live()

    resume = ResumeVersion.active()

    return {
        "site": SiteConfigSerializer(site).data,
        "sections": SectionSerializer(sections, many=True).data,
        "profile": ProfileSerializer(Profile.load()).data,
        "social_links": SocialLinkSerializer(_scope(SocialLink.objects, drafts), many=True).data,
        "focus_areas": FocusAreaSerializer(_scope(FocusArea.objects, drafts), many=True).data,
        "resume": {"label": resume.label, "url": resume.asset.url} if resume else None,
        "experience": ExperienceSerializer(
            _scope(Experience.objects, drafts).select_related("logo").prefetch_related("tags"),
            many=True,
        ).data,
        "education": EducationSerializer(_scope(Education.objects, drafts), many=True).data,
        "achievements": AchievementSerializer(_scope(Achievement.objects, drafts), many=True).data,
        "projects": ProjectSerializer(
            _scope(Project.objects, drafts).select_related("cover").prefetch_related("tags"),
            many=True,
        ).data,
        "skills": PublicSkillCategorySerializer(skills, many=True).data,
        "posts": PostListSerializer(
            posts.select_related("cover").prefetch_related("tags")[:RECENT_POSTS], many=True
        ).data
        if site.blog_enabled or drafts
        else [],
        "games": PublicGameSerializer(Game.objects.filter(is_enabled=True), many=True).data
        if site.games_enabled or drafts
        else [],
        "drafts": drafts,
    }
