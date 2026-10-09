from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.serializers import StringListField, TagNamesField
from apps.media_library.models import MediaAsset
from apps.media_library.serializers import MediaRefField

from .models import Project


class MetricSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=80)
    value = serializers.CharField(max_length=40)


@extend_schema_field({"type": "array", "items": {"type": "integer"}})
class GalleryField(serializers.Field):
    """Ordered list of asset ids on write; list of compact assets on read."""

    def to_representation(self, value):
        assets = MediaAsset.objects.in_bulk(value or [])
        ref = MediaRefField()
        return [ref.to_representation(assets[i]) for i in value or [] if i in assets]

    def to_internal_value(self, data):
        if not isinstance(data, list):
            raise serializers.ValidationError("Expected a list of media ids.")
        ids = []
        for item in data:
            pk = item.get("id") if isinstance(item, dict) else item
            if not isinstance(pk, int):
                raise serializers.ValidationError("Gallery items must be media ids.")
            ids.append(pk)
        found = set(MediaAsset.objects.filter(pk__in=ids).values_list("pk", flat=True))
        missing = [i for i in ids if i not in found]
        if missing:
            raise serializers.ValidationError(f"Unknown media ids: {missing}")
        return ids


class ProjectSerializer(serializers.ModelSerializer):
    highlights = StringListField(required=False)
    metrics = MetricSerializer(many=True, required=False)
    tags = TagNamesField(required=False)
    cover = MediaRefField()
    gallery = GalleryField(required=False)

    class Meta:
        model = Project
        fields = [
            "id",
            "title",
            "slug",
            "summary",
            "description",
            "role",
            "category",
            "status",
            "start_date",
            "end_date",
            "repo_url",
            "demo_url",
            "cover",
            "gallery",
            "highlights",
            "metrics",
            "tags",
            "is_featured",
            "order",
            "is_published",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]
        extra_kwargs = {"slug": {"required": False}}
