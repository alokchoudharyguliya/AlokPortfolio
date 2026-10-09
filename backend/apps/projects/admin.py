from django.contrib import admin

from .models import Project


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["title", "category", "status", "is_featured", "order", "is_published"]
    list_editable = ["order", "is_published", "is_featured"]
    list_filter = ["category", "status"]
    prepopulated_fields = {"slug": ["title"]}
    filter_horizontal = ["tags"]
