from rest_framework.routers import SimpleRouter

from . import views

public_router = SimpleRouter()
public_router.register("projects", views.ProjectPublicViewSet, basename="public-project")

admin_router = SimpleRouter()
admin_router.register("projects", views.ProjectAdminViewSet, basename="admin-project")

public_urlpatterns = public_router.urls
admin_urlpatterns = admin_router.urls
