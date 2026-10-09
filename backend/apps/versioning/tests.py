import pytest

from apps.projects.models import Project
from apps.versioning.models import Version

URL = "/api/v1/admin/projects/"


@pytest.mark.django_db
class TestVersioning:
    def test_create_update_delete_are_recorded(self, owner_api):
        pk = owner_api.post(URL, {"title": "v1", "tags": ["A"]}, format="json").json()["id"]
        owner_api.patch(f"{URL}{pk}/", {"title": "v2"}, format="json")
        owner_api.delete(f"{URL}{pk}/")
        actions = list(
            Version.objects.filter(object_id=str(pk))
            .order_by("id")
            .values_list("action", flat=True)
        )
        assert actions == ["create", "update", "delete"]

    def test_snapshot_includes_m2m(self, owner_api):
        pk = owner_api.post(URL, {"title": "t", "tags": ["CUDA"]}, format="json").json()["id"]
        snap = Version.objects.get(object_id=str(pk), action="create").snapshot
        assert len(snap["tags"]) == 1

    def test_detail_has_diff(self, owner_api):
        pk = owner_api.post(URL, {"title": "old"}, format="json").json()["id"]
        owner_api.patch(f"{URL}{pk}/", {"title": "new"}, format="json")
        update = Version.objects.get(object_id=str(pk), action="update")
        res = owner_api.get(f"/api/v1/admin/versions/{update.pk}/")
        changes = {c["field"]: c for c in res.json()["changes"]}
        assert changes["title"] == {"field": "title", "before": "old", "after": "new"}

    def test_restore_previous_state(self, owner_api):
        pk = owner_api.post(URL, {"title": "original", "tags": ["A"]}, format="json").json()["id"]
        owner_api.patch(f"{URL}{pk}/", {"title": "changed", "tags": []}, format="json")
        first = Version.objects.get(object_id=str(pk), action="create")
        res = owner_api.post(f"/api/v1/admin/versions/{first.pk}/restore/")
        assert res.status_code == 200
        project = Project.objects.get(pk=pk)
        assert project.title == "original"
        assert [t.name for t in project.tags.all()] == ["A"]
        assert Version.objects.filter(object_id=str(pk), action="restore").exists()

    def test_restore_deleted_object(self, owner_api):
        pk = owner_api.post(URL, {"title": "gone"}, format="json").json()["id"]
        owner_api.delete(f"{URL}{pk}/")
        deleted = Version.objects.get(object_id=str(pk), action="delete")
        owner_api.post(f"/api/v1/admin/versions/{deleted.pk}/restore/")
        assert Project.objects.filter(pk=pk, title="gone").exists()

    def test_filter_by_resource(self, owner_api):
        owner_api.post(URL, {"title": "x"}, format="json")
        owner_api.patch("/api/v1/admin/profile/", {"headline": "h"}, format="json")
        res = owner_api.get("/api/v1/admin/versions/?resource=profiles.profile")
        assert {v["resource"] for v in res.json()["results"]} == {"profiles.profile"}
