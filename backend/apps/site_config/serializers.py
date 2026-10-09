from rest_framework import serializers

from apps.blog.serializers import PostListSerializer
from apps.experience.serializers import (
    AchievementSerializer,
    EducationSerializer,
    ExperienceSerializer,
)
from apps.games.serializers import PublicGameSerializer
from apps.media_library.serializers import MediaRefField
from apps.profiles.serializers import (
    FocusAreaSerializer,
    ProfileSerializer,
    SocialLinkSerializer,
)
from apps.projects.serializers import ProjectSerializer
from apps.skills.serializers import PublicSkillCategorySerializer

from .models import Section, SiteConfig


class SiteConfigSerializer(serializers.ModelSerializer):
    og_image = MediaRefField()

    class Meta:
        model = SiteConfig
        fields = [
            "site_title",
            "meta_description",
            "og_image",
            "default_mode",
            "default_theme",
            "accent_color",
            "terminal_hostname",
            "sound_default_on",
            "blog_enabled",
            "games_enabled",
            "contact_enabled",
            "analytics_enabled",
            "footer_note",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ["id", "key", "title", "subtitle", "is_visible", "order"]
        read_only_fields = ["key"]


class ResumeLinkSerializer(serializers.Serializer):
    label = serializers.CharField()
    url = serializers.CharField()


class BootstrapSerializer(serializers.Serializer):
    """Schema-only description of the /public/bootstrap/ payload (for OpenAPI)."""

    site = SiteConfigSerializer()
    sections = SectionSerializer(many=True)
    profile = ProfileSerializer()
    social_links = SocialLinkSerializer(many=True)
    focus_areas = FocusAreaSerializer(many=True)
    resume = ResumeLinkSerializer(allow_null=True)
    experience = ExperienceSerializer(many=True)
    education = EducationSerializer(many=True)
    achievements = AchievementSerializer(many=True)
    projects = ProjectSerializer(many=True)
    skills = PublicSkillCategorySerializer(many=True)
    posts = PostListSerializer(many=True)
    games = PublicGameSerializer(many=True)
    drafts = serializers.BooleanField()
