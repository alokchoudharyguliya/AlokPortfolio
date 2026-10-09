from django.contrib import admin

from .models import Version


@admin.register(Version)
class VersionAdmin(admin.ModelAdmin):
    list_display = ["object_repr", "content_type", "action", "user", "created_at"]
    list_filter = ["action", "content_type"]
    readonly_fields = [f.name for f in Version._meta.fields]
