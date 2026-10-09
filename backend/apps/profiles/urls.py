from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

admin_router = SimpleRouter()
admin_router.register("social-links", views.SocialLinkAdminViewSet, basename="admin-social-link")
admin_router.register("focus-areas", views.FocusAreaAdminViewSet, basename="admin-focus-area")
admin_router.register("resumes", views.ResumeVersionAdminViewSet, basename="admin-resume")

# Public profile data is delivered by site_config's /public/bootstrap/ aggregate.
public_urlpatterns = []
admin_urlpatterns = [
    path("profile/", views.ProfileAdminView.as_view(), name="admin-profile"),
    *admin_router.urls,
]
