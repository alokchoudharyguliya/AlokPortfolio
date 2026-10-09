from datetime import timedelta

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.analytics.models import Event
from apps.blog.models import Post
from apps.contact.models import Message
from apps.core.permissions import IsOwner
from apps.core.viewsets import OwnerModelViewSet, OwnerSingletonView
from apps.projects.models import Project

from .models import Section, SiteConfig
from .selectors import build_bootstrap
from .serializers import BootstrapSerializer, SectionSerializer, SiteConfigSerializer


class BootstrapView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        parameters=[OpenApiParameter("drafts", bool, description="Owner only: include drafts")],
        responses=BootstrapSerializer,
    )
    def get(self, request):
        wants_drafts = request.query_params.get("drafts") in {"1", "true"}
        is_owner = IsOwner().has_permission(request, self)
        response = Response(build_bootstrap(drafts=wants_drafts and is_owner))
        response["Cache-Control"] = "private, no-store" if is_owner else "public, max-age=60"
        return response


class SiteConfigAdminView(OwnerSingletonView):
    model = SiteConfig
    serializer_class = SiteConfigSerializer


class SectionAdminViewSet(OwnerModelViewSet):
    """Sections are fixed (seeded); the owner edits titles, visibility and order."""

    queryset = Section.objects.all()
    serializer_class = SectionSerializer
    http_method_names = ["get", "patch", "post", "head", "options"]

    def create(self, request, *args, **kwargs):
        raise MethodNotAllowed("POST", detail="Sections are predefined; edit or reorder them.")


class OverviewView(APIView):
    """Counters for the dashboard home."""

    permission_classes = [IsOwner]

    @extend_schema(responses={200: dict})
    def get(self, request):
        week_ago = timezone.now() - timedelta(days=7)
        views = Event.objects.filter(kind=Event.Kind.PAGEVIEW, created_at__gte=week_ago)
        return Response(
            {
                "projects": Project.objects.count(),
                "projects_published": Project.objects.published().count(),
                "posts": Post.objects.count(),
                "posts_draft": Post.objects.filter(is_published=False).count(),
                "messages_unread": Message.objects.filter(is_read=False, is_archived=False).count(),
                "views_7d": views.count(),
                "visitors_7d": views.values("visitor_hash").distinct().count(),
            }
        )
