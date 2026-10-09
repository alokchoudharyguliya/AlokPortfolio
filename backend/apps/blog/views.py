from rest_framework import viewsets
from rest_framework.pagination import PageNumberPagination

from apps.core.viewsets import OwnerModelViewSet

from .models import Post
from .serializers import PostListSerializer, PostSerializer


class PostPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50


class PostPublicViewSet(viewsets.ReadOnlyModelViewSet):
    lookup_field = "slug"
    pagination_class = PostPagination
    filterset_fields = {"tags__slug": ["exact"], "is_featured": ["exact"]}
    search_fields = ["title", "excerpt", "body"]

    def get_queryset(self):
        return Post.objects.live().select_related("cover").prefetch_related("tags").distinct()

    def get_serializer_class(self):
        return PostListSerializer if self.action == "list" else PostSerializer


class PostAdminViewSet(OwnerModelViewSet):
    queryset = Post.objects.select_related("cover").prefetch_related("tags")
    serializer_class = PostSerializer
    pagination_class = PostPagination
    filterset_fields = ["is_published", "is_featured"]
    search_fields = ["title", "excerpt"]
