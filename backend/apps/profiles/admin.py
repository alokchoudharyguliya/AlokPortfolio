from django.contrib import admin

from .models import FocusArea, Profile, ResumeVersion, SocialLink

admin.site.register(Profile)


@admin.register(SocialLink)
class SocialLinkAdmin(admin.ModelAdmin):
    list_display = ["label", "platform", "url", "order", "is_published"]
    list_editable = ["order", "is_published"]


@admin.register(FocusArea)
class FocusAreaAdmin(admin.ModelAdmin):
    list_display = ["title", "order", "is_published"]
    list_editable = ["order", "is_published"]


@admin.register(ResumeVersion)
class ResumeVersionAdmin(admin.ModelAdmin):
    list_display = ["label", "is_active", "created_at"]
