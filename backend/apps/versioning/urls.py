from rest_framework.routers import SimpleRouter

from .views import VersionViewSet

admin_router = SimpleRouter()
admin_router.register("versions", VersionViewSet, basename="admin-version")

public_urlpatterns = []
admin_urlpatterns = admin_router.urls
