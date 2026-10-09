from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

admin_router = SimpleRouter()
admin_router.register("sections", views.SectionAdminViewSet, basename="admin-section")

public_urlpatterns = [path("bootstrap/", views.BootstrapView.as_view(), name="public-bootstrap")]
admin_urlpatterns = [
    path("site/", views.SiteConfigAdminView.as_view(), name="admin-site"),
    path("overview/", views.OverviewView.as_view(), name="admin-overview"),
    *admin_router.urls,
]
