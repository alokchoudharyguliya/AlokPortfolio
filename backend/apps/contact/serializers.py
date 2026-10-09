from rest_framework import serializers

from .models import Message


class ContactSubmitSerializer(serializers.ModelSerializer):
    # Honeypot — hidden in the UI; any value marks the submission as spam.
    website = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Message
        fields = ["name", "email", "subject", "body", "source_mode", "website"]
        extra_kwargs = {"body": {"min_length": 10}}


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = [
            "id",
            "name",
            "email",
            "subject",
            "body",
            "is_read",
            "is_starred",
            "is_archived",
            "source_mode",
            "created_at",
        ]
        read_only_fields = ["name", "email", "subject", "body", "source_mode", "created_at"]
