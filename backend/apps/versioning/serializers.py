from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from . import services
from .models import Version


class VersionListSerializer(serializers.ModelSerializer):
    resource = serializers.CharField(read_only=True)
    user = serializers.CharField(source="user.username", default=None, read_only=True)

    class Meta:
        model = Version
        fields = ["id", "resource", "object_id", "object_repr", "action", "user", "created_at"]


class VersionDetailSerializer(VersionListSerializer):
    changes = serializers.SerializerMethodField()

    class Meta(VersionListSerializer.Meta):
        fields = VersionListSerializer.Meta.fields + ["snapshot", "changes"]

    @extend_schema_field(
        {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"field": {"type": "string"}, "before": {}, "after": {}},
            },
        }
    )
    def get_changes(self, obj) -> list:
        prev = services.previous(obj)
        return services.diff(prev.snapshot if prev else None, obj.snapshot)
