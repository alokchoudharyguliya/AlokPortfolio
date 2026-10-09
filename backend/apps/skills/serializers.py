from rest_framework import serializers

from .models import Skill, SkillCategory


class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ["id", "category", "name", "level", "is_highlighted", "order", "is_published"]


class SkillCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = SkillCategory
        fields = ["id", "name", "description", "icon", "order", "is_published"]


class PublicSkillCategorySerializer(SkillCategorySerializer):
    """Category with its published skills nested (expects `published_skills` prefetch)."""

    skills = SkillSerializer(source="published_skills", many=True, read_only=True)

    class Meta(SkillCategorySerializer.Meta):
        fields = SkillCategorySerializer.Meta.fields + ["skills"]
