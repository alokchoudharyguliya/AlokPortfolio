from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Tag


@extend_schema_field({"type": "array", "items": {"type": "string"}})
class TagNamesField(serializers.Field):
    """
    Represents a M2M to `Tag` as a plain list of names, both ways:

        "tags": ["Django", "PostgreSQL"]

    Unknown names are created on write, so the frontend's tag input can stay a
    simple string list in every editor.
    """

    def to_representation(self, value):
        return [t.name for t in value.all()]

    def to_internal_value(self, data):
        if not isinstance(data, list) or not all(isinstance(x, str) for x in data):
            raise serializers.ValidationError("Expected a list of tag names.")
        names = []
        for raw in data:
            name = raw.strip()[:60]
            if name and name.lower() not in {n.lower() for n in names}:
                names.append(name)
        tags = []
        for name in names:
            tag = Tag.objects.filter(name__iexact=name).first() or Tag.objects.create(name=name)
            tags.append(tag)
        return tags


class StringListField(serializers.ListField):
    """A JSON list of non-empty strings (e.g. bullet-point highlights)."""

    child = serializers.CharField(allow_blank=False, max_length=500)


class ReorderSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "slug"]
        read_only_fields = ["slug"]
