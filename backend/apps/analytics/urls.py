from django.urls import path

from . import views

public_urlpatterns = [
    path("analytics/collect/", views.CollectView.as_view(), name="analytics-collect"),
]
admin_urlpatterns = [
    path("analytics/summary/", views.SummaryView.as_view(), name="analytics-summary"),
]
