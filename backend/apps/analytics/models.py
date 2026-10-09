from django.db import models


class Event(models.Model):
    class Kind(models.TextChoices):
        PAGEVIEW = "pageview", "Page view"
        MODE_SWITCH = "mode_switch", "Mode switch"
        THEME_SWITCH = "theme_switch", "Theme switch"
        GAME_PLAY = "game_play", "Game play"
        RESUME_DOWNLOAD = "resume_download", "Resume download"
        OUTBOUND_CLICK = "outbound_click", "Outbound link click"
        TERMINAL_COMMAND = "terminal_command", "Terminal command"

    class Device(models.TextChoices):
        MOBILE = "mobile", "Mobile"
        TABLET = "tablet", "Tablet"
        DESKTOP = "desktop", "Desktop"

    kind = models.CharField(max_length=30, choices=Kind.choices, db_index=True)
    path = models.CharField(max_length=300, blank=True)
    mode = models.CharField(max_length=20, blank=True)
    theme = models.CharField(max_length=10, blank=True)
    device = models.CharField(max_length=10, choices=Device.choices, blank=True)
    referrer = models.CharField(max_length=200, blank=True, help_text="Referrer host only")
    visitor_hash = models.CharField(max_length=64, db_index=True)
    props = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["kind", "created_at"])]

    def __str__(self):
        return f"{self.kind} {self.path} {self.created_at:%Y-%m-%d %H:%M}"
