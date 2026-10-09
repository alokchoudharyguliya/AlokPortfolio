from rest_framework import serializers

from apps.core.serializers import StringListField, TagNamesField
from apps.media_library.serializers import MediaRefField

from .models import Achievement, Education, Experience


class DateRangeValidationMixin:
    def validate(self, attrs):
        attrs = super().validate(attrs)
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "End date is before start date."})
        return attrs


class ExperienceSerializer(DateRangeValidationMixin, serializers.ModelSerializer):
    highlights = StringListField(required=False)
    tags = TagNamesField(required=False)
    logo = MediaRefField()

    class Meta:
        model = Experience
        fields = [
            "id",
            "role",
            "organization",
            "organization_url",
            "logo",
            "employment_type",
            "location",
            "start_date",
            "end_date",
            "summary",
            "highlights",
            "tags",
            "order",
            "is_published",
        ]


class EducationSerializer(DateRangeValidationMixin, serializers.ModelSerializer):
    highlights = StringListField(required=False)

    class Meta:
        model = Education
        fields = [
            "id",
            "institution",
            "degree",
            "field_of_study",
            "location",
            "start_date",
            "end_date",
            "grade",
            "description",
            "highlights",
            "order",
            "is_published",
        ]


class AchievementSerializer(serializers.ModelSerializer):
    highlights = StringListField(required=False)

    class Meta:
        model = Achievement
        fields = [
            "id",
            "title",
            "kind",
            "organization",
            "date",
            "description",
            "highlights",
            "url",
            "order",
            "is_published",
        ]
