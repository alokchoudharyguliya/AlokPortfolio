"""
Base classes for the owner (sudo) API.

Every editable resource in the dashboard is served by an `OwnerModelViewSet`
subclass, which bundles:

- `IsOwner` permission,
- CRUD (DRF ModelViewSet),
- `POST <resource>/reorder/ {"ids": [...]}` for drag-and-drop ordering,
- automatic version history on create / update / delete.

Singleton resources (Profile, SiteConfig) use `OwnerSingletonView` instead:
`GET` / `PATCH` on a fixed URL with the same versioning behaviour.
"""

from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.response import Response

from apps.versioning import services as versioning
from apps.versioning.mixins import VersionedViewSetMixin
from apps.versioning.models import Version

from .permissions import IsOwner
from .serializers import ReorderSerializer


class ReorderMixin:
    """Adds a `reorder` collection action for models inheriting OrderableModel."""

    @extend_schema(request=ReorderSerializer, responses=ReorderSerializer)
    @action(detail=False, methods=["post"])
    def reorder(self, request):
        serializer = ReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]
        model = self.get_queryset().model
        if not any(f.name == "order" for f in model._meta.fields):
            raise MethodNotAllowed("POST", detail=f"{model.__name__} is not orderable.")
        objects = {obj.pk: obj for obj in model.objects.filter(pk__in=ids)}
        with transaction.atomic():
            for index, pk in enumerate(ids):
                if pk in objects:
                    objects[pk].order = index
            model.objects.bulk_update(objects.values(), ["order"])
        return Response({"ids": ids})


class OwnerModelViewSet(VersionedViewSetMixin, ReorderMixin, viewsets.ModelViewSet):
    permission_classes = [IsOwner]
    pagination_class = None


class OwnerSingletonView(generics.RetrieveUpdateAPIView):
    """GET/PATCH a SingletonModel; records history on every update."""

    permission_classes = [IsOwner]
    model = None  # set by subclasses

    def get_object(self):
        return self.model.load()

    def perform_update(self, serializer):
        super().perform_update(serializer)
        versioning.record(serializer.instance, Version.Action.UPDATE, self.request.user)
