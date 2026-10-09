import pytest
from django.core.management import call_command

from apps.blog.models import Post
from apps.projects.models import Project
from apps.site_config.models import Section, SiteConfig

BOOT = "/api/v1/public/bootstrap/"


@pytest.mark.django_db
class TestBootstrap:
    def test_shape(self, api):
        data = api.get(BOOT).json()
        for key in ("site", "sections", "profile", "projects", "skills", "games", "posts"):
            assert key in data
        assert len(data["sections"]) == 11  # seeded by migration
        assert [g["slug"] for g in data["games"]] == [
            "pop-the-bugs",
            "token-snake",
            "warp-scheduler",
            "road-trip",
        ]

    def test_hides_unpublished_and_hidden_sections(self, api):
        Project.objects.create(title="Live")
        Project.objects.create(title="Secret", is_published=False)
        Section.objects.filter(key="arcade").update(is_visible=False)
        data = api.get(BOOT).json()
        assert [p["title"] for p in data["projects"]] == ["Live"]
        assert "arcade" not in [s["key"] for s in data["sections"]]

    def test_drafts_only_for_owner(self, api, owner_api):
        Project.objects.create(title="Secret", is_published=False)
        assert api.get(f"{BOOT}?drafts=1").json()["drafts"] is False
        data = owner_api.get(f"{BOOT}?drafts=1").json()
        assert data["drafts"] is True
        assert "Secret" in [p["title"] for p in data["projects"]]

    def test_feature_flags(self, api):
        Post.objects.create(title="P", is_published=True)
        site = SiteConfig.load()
        site.blog_enabled = False
        site.games_enabled = False
        site.save()
        data = api.get(BOOT).json()
        assert data["posts"] == [] and data["games"] == []


@pytest.mark.django_db
def test_sections_cannot_be_created(owner_api):
    res = owner_api.post("/api/v1/admin/sections/", {"key": "x", "title": "x"}, format="json")
    assert res.status_code == 405


@pytest.mark.django_db
def test_site_config_validation(owner_api):
    res = owner_api.patch("/api/v1/admin/site/", {"accent_color": "red"}, format="json")
    assert res.status_code == 400
    res = owner_api.patch(
        "/api/v1/admin/site/",
        {"accent_color": "#00ffaa", "default_mode": "terminal"},
        format="json",
    )
    assert res.status_code == 200
    assert res.json()["default_mode"] == "terminal"


@pytest.mark.django_db
def test_seed_is_idempotent():
    call_command("seed_portfolio")
    count = Project.objects.count()
    call_command("seed_portfolio")
    assert Project.objects.count() == count > 0
    call_command("seed_portfolio", force=True)
    assert Project.objects.count() == count


@pytest.mark.django_db
def test_default_mode_accepts_every_presentation_mode(owner_api):
    for mode in ("simple", "terminal", "3d", "drive"):
        res = owner_api.patch("/api/v1/admin/site/", {"default_mode": mode}, format="json")
        assert res.status_code == 200, mode
        assert res.json()["default_mode"] == mode
    bad = owner_api.patch("/api/v1/admin/site/", {"default_mode": "vr"}, format="json")
    assert bad.status_code == 400
