from django.contrib import admin

from .models import MediaAsset


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ["__str__", "kind", "mime_type", "size", "created_at"]
    list_filter = ["kind"]
    search_fields = ["title", "original_name"]
