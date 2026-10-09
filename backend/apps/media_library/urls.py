from rest_framework.routers import SimpleRouter

from .views import MediaAssetAdminViewSet

admin_router = SimpleRouter()
admin_router.register("media", MediaAssetAdminViewSet, basename="admin-media")

public_urlpatterns = []
admin_urlpatterns = admin_router.urls
