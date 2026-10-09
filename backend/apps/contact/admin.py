from django.contrib import admin

from .models import Message


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ["name", "email", "subject", "is_read", "is_starred", "created_at"]
    list_filter = ["is_read", "is_starred", "is_archived"]
    search_fields = ["name", "email", "subject", "body"]
