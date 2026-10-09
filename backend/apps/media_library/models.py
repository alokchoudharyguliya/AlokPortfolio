import mimetypes
import uuid
from pathlib import Path

from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"}
DOCUMENT_EXTENSIONS = {".pdf", ".txt", ".md"}
AUDIO_EXTENSIONS = {".mp3", ".ogg", ".wav", ".m4a"}
VIDEO_EXTENSIONS = {".mp4", ".webm"}
ALLOWED_EXTENSIONS = IMAGE_EXTENSIONS | DOCUMENT_EXTENSIONS | AUDIO_EXTENSIONS | VIDEO_EXTENSIONS


def upload_path(instance, filename: str) -> str:
    """uploads/2026/10/<uuid>.<ext> — random names avoid collisions and guessing."""
    ext = Path(filename).suffix.lower()
    now = timezone.now()
    return f"uploads/{now:%Y/%m}/{uuid.uuid4().hex}{ext}"


class MediaAsset(TimeStampedModel):
    class Kind(models.TextChoices):
        IMAGE = "image", "Image"
        DOCUMENT = "document", "Document"
        AUDIO = "audio", "Audio"
        VIDEO = "video", "Video"
        OTHER = "other", "Other"

    file = models.FileField(upload_to=upload_path, max_length=255)
    original_name = models.CharField(max_length=255, blank=True)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.OTHER, db_index=True)
    title = models.CharField(max_length=200, blank=True)
    alt_text = models.CharField(
        max_length=300, blank=True, help_text="Accessibility text for images"
    )
    mime_type = models.CharField(max_length=100, blank=True)
    size = models.PositiveBigIntegerField(default=0)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title or self.original_name or self.file.name

    @property
    def url(self) -> str:
        return self.file.url if self.file else ""

    def populate_metadata(self):
        """Fill kind / mime / size / dimensions from the uploaded file."""
        name = self.original_name or self.file.name
        ext = Path(name).suffix.lower()
        self.mime_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
        self.size = getattr(self.file, "size", 0) or 0
        if ext in IMAGE_EXTENSIONS:
            self.kind = self.Kind.IMAGE
        elif ext in DOCUMENT_EXTENSIONS:
            self.kind = self.Kind.DOCUMENT
        elif ext in AUDIO_EXTENSIONS:
            self.kind = self.Kind.AUDIO
        elif ext in VIDEO_EXTENSIONS:
            self.kind = self.Kind.VIDEO
        if self.kind == self.Kind.IMAGE and ext != ".svg":
            try:
                from PIL import Image

                self.file.seek(0)
                with Image.open(self.file) as img:
                    self.width, self.height = img.size
                self.file.seek(0)
            except Exception:  # unreadable image: keep dimensions empty
                self.width = self.height = None
