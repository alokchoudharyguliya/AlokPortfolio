from django.contrib import admin

from .models import Post


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ["title", "is_published", "published_at", "is_featured"]
    list_filter = ["is_published", "is_featured"]
    search_fields = ["title", "body"]
    prepopulated_fields = {"slug": ["title"]}
