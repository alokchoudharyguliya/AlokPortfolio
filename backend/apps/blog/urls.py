from rest_framework.routers import SimpleRouter

from . import views

public_router = SimpleRouter()
public_router.register("posts", views.PostPublicViewSet, basename="public-post")

admin_router = SimpleRouter()
admin_router.register("posts", views.PostAdminViewSet, basename="admin-post")

public_urlpatterns = public_router.urls
admin_urlpatterns = admin_router.urls
