from rest_framework.routers import SimpleRouter

from . import views

admin_router = SimpleRouter()
admin_router.register("experience", views.ExperienceAdminViewSet, basename="admin-experience")
admin_router.register("education", views.EducationAdminViewSet, basename="admin-education")
admin_router.register("achievements", views.AchievementAdminViewSet, basename="admin-achievement")

# Public timeline data is delivered by site_config's /public/bootstrap/ aggregate.
public_urlpatterns = []
admin_urlpatterns = admin_router.urls
