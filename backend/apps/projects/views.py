from rest_framework import viewsets

from apps.core.viewsets import OwnerModelViewSet

from .models import Project
from .serializers import ProjectSerializer


def _base_queryset():
    return Project.objects.select_related("cover").prefetch_related("tags")


class ProjectPublicViewSet(viewsets.ReadOnlyModelViewSet):
    """Published projects; detail is looked up by slug."""

    serializer_class = ProjectSerializer
    lookup_field = "slug"
    pagination_class = None
    filterset_fields = ["category", "is_featured"]
    search_fields = ["title", "summary", "tags__name"]

    def get_queryset(self):
        return _base_queryset().published()


class ProjectAdminViewSet(OwnerModelViewSet):
    queryset = _base_queryset()
    serializer_class = ProjectSerializer
    filterset_fields = ["category", "status", "is_published", "is_featured"]
    search_fields = ["title", "summary"]
