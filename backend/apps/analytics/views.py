from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.core.permissions import IsOwner
from apps.core.utils import visitor_hash

from . import selectors
from .serializers import CollectSerializer


class CollectView(APIView):
    """Beacon endpoint. Unauthenticated by design (no cookies, no CSRF)."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "analytics"

    @extend_schema(request=CollectSerializer, responses={202: None})
    def post(self, request):
        serializer = CollectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(visitor_hash=visitor_hash(request))
        return Response(status=status.HTTP_202_ACCEPTED)


class SummaryView(APIView):
    permission_classes = [IsOwner]

    @extend_schema(parameters=[OpenApiParameter("days", int)], responses={200: dict})
    def get(self, request):
        try:
            days = int(request.query_params.get("days", 30))
        except ValueError:
            days = 30
        days = max(1, min(days, 365))
        return Response(selectors.summary(days))
