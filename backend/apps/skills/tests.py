import pytest

from apps.skills.models import SkillCategory


@pytest.mark.django_db
class TestSkillCategoryExhibit:
    def test_exhibit_is_optional_and_exposed_publicly(self, api):
        SkillCategory.objects.create(name="Systems", exhibit="hardware")
        SkillCategory.objects.create(name="Languages")
        by_name = {c["name"]: c for c in api.get("/api/v1/public/bootstrap/").json()["skills"]}
        assert by_name["Systems"]["exhibit"] == "hardware"
        assert by_name["Languages"]["exhibit"] == ""

    def test_unknown_exhibit_rejected(self, owner_api):
        res = owner_api.post(
            "/api/v1/admin/skill-categories/", {"name": "X", "exhibit": "nope"}, format="json"
        )
        assert res.status_code == 400
        assert "exhibit" in res.json()["error"]["fields"]

    def test_owner_can_link_an_exhibit(self, owner_api):
        res = owner_api.post(
            "/api/v1/admin/skill-categories/", {"name": "Low level", "exhibit": "hardware"}, format="json"
        )
        assert res.status_code == 201, res.content
        assert res.json()["exhibit"] == "hardware"
