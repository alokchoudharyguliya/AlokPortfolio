import pytest

from apps.media_library.models import MediaAsset
from apps.projects.models import Project


@pytest.mark.django_db
class TestProjects:
    def test_public_list_and_detail_by_slug(self, api):
        Project.objects.create(title="Fast Server")
        Project.objects.create(title="Hidden", is_published=False)
        assert [p["slug"] for p in api.get("/api/v1/public/projects/").json()] == ["fast-server"]
        assert api.get("/api/v1/public/projects/fast-server/").status_code == 200
        assert api.get("/api/v1/public/projects/hidden/").status_code == 404

    def test_metrics_and_highlights_validated(self, owner_api):
        res = owner_api.post(
            "/api/v1/admin/projects/",
            {"title": "M", "metrics": [{"label": "p95"}], "highlights": [""]},
            format="json",
        )
        assert res.status_code == 400
        assert {"metrics", "highlights"} <= set(res.json()["error"]["fields"])

    def test_gallery_round_trip(self, owner_api):
        a = MediaAsset.objects.create(file="uploads/a.png", kind="image")
        b = MediaAsset.objects.create(file="uploads/b.png", kind="image")
        res = owner_api.post(
            "/api/v1/admin/projects/", {"title": "G", "gallery": [b.pk, a.pk]}, format="json"
        )
        assert [g["id"] for g in res.json()["gallery"]] == [b.pk, a.pk]
        bad = owner_api.post(
            "/api/v1/admin/projects/", {"title": "G2", "gallery": [9999]}, format="json"
        )
        assert bad.status_code == 400
