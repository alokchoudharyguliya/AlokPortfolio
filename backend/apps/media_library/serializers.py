from pathlib import Path

from django.conf import settings
from rest_framework import serializers

from .models import ALLOWED_EXTENSIONS, MediaAsset


class MediaAssetSerializer(serializers.ModelSerializer):
    """Full representation for the dashboard media library."""

    url = serializers.CharField(read_only=True)
    file = serializers.FileField(write_only=True, required=True)

    class Meta:
        model = MediaAsset
        fields = [
            "id",
            "url",
            "file",
            "original_name",
            "kind",
            "title",
            "alt_text",
            "mime_type",
            "size",
            "width",
            "height",
            "created_at",
        ]
        read_only_fields = [
            "original_name",
            "kind",
            "mime_type",
            "size",
            "width",
            "height",
            "created_at",
        ]

    def get_fields(self):
        fields = super().get_fields()
        # The file is immutable after upload; only metadata can be edited.
        if self.instance is not None:
            fields.pop("file")
        return fields

    def validate_file(self, upload):
        ext = Path(upload.name).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(f"File type '{ext}' is not allowed.")
        if upload.size > settings.MEDIA_MAX_UPLOAD_BYTES:
            limit_mb = settings.MEDIA_MAX_UPLOAD_BYTES // (1024 * 1024)
            raise serializers.ValidationError(f"File too large (max {limit_mb} MB).")
        return upload

    def create(self, validated_data):
        upload = validated_data["file"]
        asset = MediaAsset(**validated_data)
        asset.original_name = upload.name[:255]
        asset.populate_metadata()
        asset.save()
        return asset


class MediaRefField(serializers.PrimaryKeyRelatedField):
    """
    FK-to-MediaAsset field used by content serializers: accepts an asset id on
    write and renders a compact object on read (see app docstring).
    """

    def __init__(self, **kwargs):
        kwargs.setdefault("queryset", MediaAsset.objects.all())
        kwargs.setdefault("allow_null", True)
        kwargs.setdefault("required", False)
        super().__init__(**kwargs)

    def use_pk_only_optimization(self):
        return False

    def to_representation(self, value):
        return {
            "id": value.pk,
            "url": value.url,
            "alt": value.alt_text or value.title,
            "kind": value.kind,
            "width": value.width,
            "height": value.height,
        }
