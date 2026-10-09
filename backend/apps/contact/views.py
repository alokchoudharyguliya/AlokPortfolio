from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.core.permissions import IsOwner
from apps.core.utils import visitor_hash

from .models import Message
from .serializers import ContactSubmitSerializer, MessageSerializer


class ContactSubmitView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "contact"

    @extend_schema(request=ContactSubmitSerializer, responses={201: dict})
    def post(self, request):
        serializer = ContactSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        honeypot = data.pop("website", "")
        if not honeypot:
            Message.objects.create(
                **data,
                visitor_hash=visitor_hash(request, daily=False),
                user_agent=request.META.get("HTTP_USER_AGENT", "")[:300],
            )
        # Same response for spam so bots learn nothing.
        return Response({"ok": True}, status=status.HTTP_201_CREATED)


class InboxPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class MessageAdminViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Owner inbox. Messages are immutable except for their flags."""

    permission_classes = [IsOwner]
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    pagination_class = InboxPagination
    filterset_fields = ["is_read", "is_starred", "is_archived"]
    search_fields = ["name", "email", "subject", "body"]

    @extend_schema(responses={200: dict})
    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        count = Message.objects.filter(is_read=False, is_archived=False).count()
        return Response({"unread": count})

    @extend_schema(request=None, responses={200: dict})
    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        updated = Message.objects.filter(is_read=False).update(is_read=True)
        return Response({"updated": updated})
