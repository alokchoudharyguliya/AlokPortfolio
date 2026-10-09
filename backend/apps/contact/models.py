from django.db import models

from apps.core.models import TimeStampedModel


class Message(TimeStampedModel):
    name = models.CharField(max_length=120)
    email = models.EmailField()
    subject = models.CharField(max_length=200, blank=True)
    body = models.TextField(max_length=5000)
    is_read = models.BooleanField(default=False, db_index=True)
    is_starred = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False, db_index=True)
    visitor_hash = models.CharField(max_length=64, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)
    source_mode = models.CharField(max_length=20, blank=True, help_text="UI mode used to send")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} <{self.email}>: {self.subject or self.body[:40]}"
