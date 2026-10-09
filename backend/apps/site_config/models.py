from django.core.validators import RegexValidator
from django.db import models

from apps.core.models import OrderableModel, SingletonModel, TimeStampedModel
from apps.media_library.models import MediaAsset


class PresentationMode(models.TextChoices):
    SIMPLE = "simple", "Simple"
    TERMINAL = "terminal", "Terminal"
    THREE_D = "3d", "3D"
    DRIVE = "drive", "Drive"


class ThemePreference(models.TextChoices):
    SYSTEM = "system", "Follow system"
    DARK = "dark", "Dark"
    LIGHT = "light", "Light"


class SiteConfig(SingletonModel, TimeStampedModel):
    site_title = models.CharField(max_length=120, default="Portfolio")
    meta_description = models.CharField(max_length=300, blank=True)
    og_image = models.ForeignKey(
        MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    default_mode = models.CharField(
        max_length=10, choices=PresentationMode.choices, default=PresentationMode.SIMPLE
    )
    default_theme = models.CharField(
        max_length=10, choices=ThemePreference.choices, default=ThemePreference.SYSTEM
    )
    accent_color = models.CharField(
        max_length=7,
        default="#e8a33d",
        validators=[RegexValidator(r"^#[0-9a-fA-F]{6}$", "Use a hex colour like #e8a33d")],
    )
    terminal_hostname = models.CharField(max_length=40, default="guest@portfolio")
    sound_default_on = models.BooleanField(default=False)
    blog_enabled = models.BooleanField(default=True)
    games_enabled = models.BooleanField(default=True)
    contact_enabled = models.BooleanField(default=True)
    analytics_enabled = models.BooleanField(default=True)
    footer_note = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return self.site_title


class Section(OrderableModel, TimeStampedModel):
    """Homepage section metadata shared by all presentation modes."""

    class Key(models.TextChoices):
        HERO = "hero", "Hero"
        ABOUT = "about", "About"
        FOCUS = "focus", "Current focus"
        EXPERIENCE = "experience", "Experience"
        PROJECTS = "projects", "Projects"
        SKILLS = "skills", "Skills"
        EDUCATION = "education", "Education"
        ACHIEVEMENTS = "achievements", "Leadership & achievements"
        BLOG = "blog", "Writing"
        ARCADE = "arcade", "Arcade"
        CONTACT = "contact", "Contact"

    key = models.CharField(max_length=20, choices=Key.choices, unique=True)
    title = models.CharField(max_length=120)
    subtitle = models.CharField(max_length=300, blank=True)
    is_visible = models.BooleanField(default=True)

    class Meta(OrderableModel.Meta):
        pass

    def __str__(self):
        return self.title
