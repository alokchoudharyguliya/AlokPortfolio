from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

admin_router = SimpleRouter()
admin_router.register("messages", views.MessageAdminViewSet, basename="admin-message")

public_urlpatterns = [path("contact/", views.ContactSubmitView.as_view(), name="public-contact")]
admin_urlpatterns = admin_router.urls
