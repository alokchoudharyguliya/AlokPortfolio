from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Tag
from .serializers import TagSerializer
from .viewsets import OwnerModelViewSet


class TagAdminViewSet(OwnerModelViewSet):
    """Owner CRUD for tags (rename / merge-by-delete). Tags are mostly created implicitly."""

    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    search_fields = ["name"]


@extend_schema(responses={200: dict})
@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    """Liveness probe used by the PaaS health check."""
    return Response({"status": "ok"})
