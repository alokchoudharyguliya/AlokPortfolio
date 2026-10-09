from rest_framework.routers import SimpleRouter

from . import views

admin_router = SimpleRouter()
admin_router.register(
    "skill-categories", views.SkillCategoryAdminViewSet, basename="admin-skill-category"
)
admin_router.register("skills", views.SkillAdminViewSet, basename="admin-skill")

# Public skills are delivered by site_config's /public/bootstrap/ aggregate.
public_urlpatterns = []
admin_urlpatterns = admin_router.urls
