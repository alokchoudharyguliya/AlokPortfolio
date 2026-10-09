from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import TagAdminViewSet, health

admin_router = SimpleRouter()
admin_router.register("tags", TagAdminViewSet, basename="admin-tag")

public_urlpatterns = [path("health/", health, name="health")]
admin_urlpatterns = admin_router.urls
