import pytest

from apps.analytics.models import Event

URL = "/api/v1/public/analytics/collect/"


@pytest.mark.django_db
class TestAnalytics:
    def test_collect_keeps_only_referrer_host(self, api):
        res = api.post(
            URL,
            {
                "kind": "pageview",
                "path": "/",
                "mode": "simple",
                "theme": "dark",
                "device": "mobile",
                "referrer": "https://news.ycombinator.com/item?id=123&user=me",
            },
            format="json",
        )
        assert res.status_code == 202
        event = Event.objects.get()
        assert event.referrer == "news.ycombinator.com"
        assert len(event.visitor_hash) == 32

    def test_rejects_unknown_kind_and_huge_props(self, api):
        assert api.post(URL, {"kind": "hack"}, format="json").status_code == 400
        res = api.post(URL, {"kind": "game_play", "props": {"x": "y" * 2000}}, format="json")
        assert res.status_code == 400

    def test_summary(self, api, owner_api):
        for mode in ("simple", "simple", "terminal"):
            api.post(URL, {"kind": "pageview", "path": "/", "mode": mode}, format="json")
        api.post(URL, {"kind": "game_play", "props": {"game": "token-snake"}}, format="json")
        data = owner_api.get("/api/v1/admin/analytics/summary/?days=7").json()
        assert data["totals"]["pageviews"] == 3
        assert data["totals"]["visitors"] == 1
        assert len(data["daily"]) == 7 and data["daily"][-1]["views"] == 3
        assert data["by_mode"][0] == {"key": "simple", "count": 2}
        assert data["games"] == [{"key": "token-snake", "count": 1}]
