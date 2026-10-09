from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.core.permissions import IsOwner

from . import services
from .models import Version
from .serializers import VersionDetailSerializer, VersionListSerializer


class VersionPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


@extend_schema(
    parameters=[
        OpenApiParameter("resource", str, description="e.g. 'projects.project'"),
        OpenApiParameter("object_id", str),
    ]
)
class VersionViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Owner-only browsing and restoring of content history."""

    permission_classes = [IsOwner]
    pagination_class = VersionPagination
    filter_backends = []

    def get_queryset(self):
        qs = Version.objects.select_related("content_type", "user")
        resource = self.request.query_params.get("resource")
        if resource and "." in resource:
            app_label, model = resource.lower().split(".", 1)
            qs = qs.filter(content_type__app_label=app_label, content_type__model=model)
        object_id = self.request.query_params.get("object_id")
        if object_id:
            qs = qs.filter(object_id=object_id)
        action_ = self.request.query_params.get("action")
        if action_:
            qs = qs.filter(action=action_)
        return qs

    def get_serializer_class(self):
        return VersionDetailSerializer if self.action == "retrieve" else VersionListSerializer

    @extend_schema(request=None, responses=VersionListSerializer)
    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        version = get_object_or_404(Version, pk=pk)
        restored = services.restore(version, request.user)
        latest = Version.objects.filter(
            content_type=version.content_type, object_id=str(restored.pk)
        ).first()
        return Response(VersionListSerializer(latest).data)
