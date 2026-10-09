from datetime import timedelta

import pytest
from django.utils import timezone

from apps.blog.models import Post


@pytest.mark.django_db
class TestPosts:
    def test_drafts_and_scheduled_posts_are_not_public(self, api):
        Post.objects.create(title="Draft")
        Post.objects.create(title="Live", is_published=True)
        Post.objects.create(
            title="Scheduled", is_published=True, published_at=timezone.now() + timedelta(days=1)
        )
        titles = [p["title"] for p in api.get("/api/v1/public/posts/").json()["results"]]
        assert titles == ["Live"]
        assert api.get("/api/v1/public/posts/draft/").status_code == 404

    def test_publishing_stamps_published_at(self, owner_api):
        pk = owner_api.post("/api/v1/admin/posts/", {"title": "Hello"}, format="json").json()["id"]
        assert Post.objects.get(pk=pk).published_at is None
        owner_api.patch(f"/api/v1/admin/posts/{pk}/", {"is_published": True}, format="json")
        assert Post.objects.get(pk=pk).published_at is not None

    def test_detail_includes_body_and_reading_time(self, api):
        Post.objects.create(title="Long", is_published=True, body="word " * 500)
        data = api.get("/api/v1/public/posts/long/").json()
        assert data["reading_minutes"] == 3
        assert "body" in data

    def test_unique_slugs(self):
        a = Post.objects.create(title="Same")
        b = Post.objects.create(title="Same")
        assert a.slug == "same" and b.slug == "same-2"
