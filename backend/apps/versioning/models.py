from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.db import models


class Version(models.Model):
    """
    One immutable snapshot of a content object at a point in time.

    `snapshot` holds the object's serialized fields (Django's JSON serializer
    format, including M2M primary keys), which is exactly what `restore`
    feeds back into the deserializer.
    """

    class Action(models.TextChoices):
        CREATE = "create", "Created"
        UPDATE = "update", "Updated"
        DELETE = "delete", "Deleted"
        RESTORE = "restore", "Restored"

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=64)
    object_repr = models.CharField(max_length=200)
    action = models.CharField(max_length=10, choices=Action.choices)
    snapshot = models.JSONField()
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["content_type", "object_id", "-created_at"])]

    def __str__(self):
        return f"{self.resource}#{self.object_id} {self.action}"

    @property
    def resource(self) -> str:
        """Stable identifier used by the frontend, e.g. 'projects.project'."""
        return f"{self.content_type.app_label}.{self.content_type.model}"
