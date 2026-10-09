from django.contrib import admin

from .models import Event


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ["kind", "path", "mode", "device", "created_at"]
    list_filter = ["kind", "mode", "device"]
    date_hierarchy = "created_at"
