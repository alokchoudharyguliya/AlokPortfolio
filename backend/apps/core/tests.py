"""Cross-cutting behaviour: owner permission, error envelope, reorder, tags."""

import pytest

from apps.core.models import Tag
from apps.projects.models import Project

ADMIN_ENDPOINTS = [
    "/api/v1/admin/projects/",
    "/api/v1/admin/profile/",
    "/api/v1/admin/site/",
    "/api/v1/admin/messages/",
    "/api/v1/admin/media/",
    "/api/v1/admin/versions/",
    "/api/v1/admin/analytics/summary/",
    "/api/v1/admin/overview/",
]


@pytest.mark.django_db
@pytest.mark.parametrize("url", ADMIN_ENDPOINTS)
def test_admin_endpoints_require_owner(api, url):
    res = api.get(url)
    assert res.status_code == 401
    assert res.json()["error"]["status"] == 401


@pytest.mark.django_db
@pytest.mark.parametrize("url", ADMIN_ENDPOINTS)
def test_admin_endpoints_open_for_owner(owner_api, url):
    assert owner_api.get(url).status_code == 200


@pytest.mark.django_db
def test_validation_error_envelope(owner_api):
    res = owner_api.post("/api/v1/admin/projects/", {"title": ""}, format="json")
    assert res.status_code == 400
    err = res.json()["error"]
    assert err["code"] == "invalid"
    assert "title" in err["fields"]


@pytest.mark.django_db
def test_reorder(owner_api):
    a, b, c = (Project.objects.create(title=t) for t in "ABC")
    res = owner_api.post(
        "/api/v1/admin/projects/reorder/", {"ids": [c.pk, a.pk, b.pk]}, format="json"
    )
    assert res.status_code == 200
    assert list(Project.objects.values_list("title", flat=True)) == ["C", "A", "B"]


@pytest.mark.django_db
def test_reorder_rejected_for_unorderable_model(owner_api):
    tag = Tag.objects.create(name="x")
    res = owner_api.post("/api/v1/admin/tags/reorder/", {"ids": [tag.pk]}, format="json")
    assert res.status_code == 405


@pytest.mark.django_db
def test_tag_names_field_creates_and_dedupes(owner_api):
    Tag.objects.create(name="Django")
    res = owner_api.post(
        "/api/v1/admin/projects/",
        {"title": "T", "tags": ["django", "CUDA", "cuda", " "]},
        format="json",
    )
    assert res.status_code == 201
    assert sorted(res.json()["tags"]) == ["CUDA", "Django"]
    assert Tag.objects.count() == 2


def test_health(client):
    assert client.get("/api/v1/public/health/").json() == {"status": "ok"}
