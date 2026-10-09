import json
from urllib.parse import urlparse

from rest_framework import serializers

from .models import Event


class CollectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ["kind", "path", "mode", "theme", "device", "referrer", "props"]

    def validate_referrer(self, value):
        """Keep only the host — never full URLs (they can contain personal data)."""
        if not value:
            return ""
        host = urlparse(value if "//" in value else f"//{value}").hostname or ""
        return host[:200]

    def validate_props(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("props must be an object.")
        if len(json.dumps(value)) > 1000:
            raise serializers.ValidationError("props too large.")
        return value
