from rest_framework import viewsets
from rest_framework.pagination import PageNumberPagination

from apps.core.permissions import IsOwner

from .models import MediaAsset
from .serializers import MediaAssetSerializer


class MediaPagination(PageNumberPagination):
    page_size = 40
    page_size_query_param = "page_size"
    max_page_size = 200


class MediaAssetAdminViewSet(viewsets.ModelViewSet):
    """
    Owner media library: upload (multipart POST), list/search, edit metadata,
    delete (also removes the stored file). Content rows referencing a deleted
    asset fall back to null via `on_delete=SET_NULL`.
    """

    permission_classes = [IsOwner]
    queryset = MediaAsset.objects.all()
    serializer_class = MediaAssetSerializer
    pagination_class = MediaPagination
    filterset_fields = ["kind"]
    search_fields = ["title", "original_name", "alt_text"]
    ordering_fields = ["created_at", "size", "title"]

    def perform_destroy(self, instance):
        storage, name = instance.file.storage, instance.file.name
        super().perform_destroy(instance)
        if name:
            storage.delete(name)
