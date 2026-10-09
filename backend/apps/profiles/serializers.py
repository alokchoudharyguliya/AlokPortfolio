from rest_framework import serializers

from apps.core.serializers import StringListField
from apps.media_library.serializers import MediaRefField

from .models import FocusArea, Profile, ResumeVersion, SocialLink


class ProfileSerializer(serializers.ModelSerializer):
    roles = StringListField(required=False)
    journey = StringListField(required=False)
    avatar = MediaRefField()

    class Meta:
        model = Profile
        fields = [
            "full_name",
            "headline",
            "tagline",
            "roles",
            "journey",
            "bio",
            "about",
            "philosophy",
            "location",
            "email",
            "availability",
            "is_available",
            "avatar",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class SocialLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialLink
        fields = ["id", "platform", "label", "url", "order", "is_published"]


class FocusAreaSerializer(serializers.ModelSerializer):
    items = StringListField(required=False)

    class Meta:
        model = FocusArea
        fields = ["id", "title", "description", "icon", "items", "order", "is_published"]


class ResumeVersionSerializer(serializers.ModelSerializer):
    asset = MediaRefField(allow_null=False, required=True)

    class Meta:
        model = ResumeVersion
        fields = ["id", "label", "asset", "notes", "is_active", "created_at"]
        read_only_fields = ["created_at"]
