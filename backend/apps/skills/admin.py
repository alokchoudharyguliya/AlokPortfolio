from django.contrib import admin

from .models import Skill, SkillCategory


class SkillInline(admin.TabularInline):
    model = Skill
    extra = 0


@admin.register(SkillCategory)
class SkillCategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "order", "is_published"]
    inlines = [SkillInline]
