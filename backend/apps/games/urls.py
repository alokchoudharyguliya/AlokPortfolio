from rest_framework.routers import SimpleRouter

from . import views

public_router = SimpleRouter()
public_router.register("games", views.GamePublicViewSet, basename="public-game")

admin_router = SimpleRouter()
admin_router.register("games", views.GameAdminViewSet, basename="admin-game")
admin_router.register("scores", views.ScoreAdminViewSet, basename="admin-score")

public_urlpatterns = public_router.urls
admin_urlpatterns = admin_router.urls
