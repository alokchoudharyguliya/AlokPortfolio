from django.contrib import admin

from .models import Achievement, Education, Experience


@admin.register(Experience)
class ExperienceAdmin(admin.ModelAdmin):
    list_display = ["role", "organization", "start_date", "end_date", "order", "is_published"]
    list_editable = ["order", "is_published"]


@admin.register(Education)
class EducationAdmin(admin.ModelAdmin):
    list_display = ["degree", "institution", "order", "is_published"]


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ["title", "kind", "date", "order", "is_published"]
    list_filter = ["kind"]
