from django.contrib import admin

from .models import Section, SiteConfig

admin.site.register(SiteConfig)


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ["key", "title", "is_visible", "order"]
    list_editable = ["title", "is_visible", "order"]
