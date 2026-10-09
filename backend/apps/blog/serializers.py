from rest_framework import serializers

from apps.core.serializers import TagNamesField
from apps.media_library.serializers import MediaRefField

from .models import Post


class PostListSerializer(serializers.ModelSerializer):
    tags = TagNamesField(required=False)
    cover = MediaRefField()
    reading_minutes = serializers.IntegerField(read_only=True)

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "slug",
            "excerpt",
            "cover",
            "tags",
            "is_featured",
            "is_published",
            "published_at",
            "reading_minutes",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class PostSerializer(PostListSerializer):
    class Meta(PostListSerializer.Meta):
        fields = PostListSerializer.Meta.fields + ["body"]
        extra_kwargs = {"slug": {"required": False}}
