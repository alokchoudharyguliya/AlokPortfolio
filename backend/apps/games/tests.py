import time

import pytest
from django.core import signing

from apps.games import services
from apps.games.models import Game, Score

BASE = "/api/v1/public/games/token-snake"


def start(api):
    return api.post(f"{BASE}/session/").json()["token"]


def backdate(token, seconds):
    """Forge an otherwise-valid token that started `seconds` ago."""
    data = signing.loads(token, salt=services.SESSION_SALT)
    data["t"] -= seconds
    return signing.dumps(data, salt=services.SESSION_SALT)


@pytest.mark.django_db
class TestGames:
    def test_list_only_enabled(self, api):
        Game.objects.filter(slug="warp-scheduler").update(is_enabled=False)
        slugs = [g["slug"] for g in api.get("/api/v1/public/games/").json()]
        assert slugs == ["pop-the-bugs", "token-snake", "road-trip"]
        assert api.post("/api/v1/public/games/warp-scheduler/session/").status_code == 404

    def test_submit_and_rank(self, api):
        token = backdate(start(api), 20)
        payload = {"token": token, "nickname": "ada", "score": 120, "duration_ms": 20_000}
        res = api.post(f"{BASE}/scores/", payload, format="json")
        assert res.status_code == 201, res.json()
        assert res.json()["rank"] == 1
        assert res.json()["leaderboard"][0]["nickname"] == "ada"

    def test_token_cannot_be_reused(self, api):
        token = backdate(start(api), 10)
        payload = {"token": token, "nickname": "ada", "score": 10, "duration_ms": 5_000}
        assert api.post(f"{BASE}/scores/", payload, format="json").status_code == 201
        res = api.post(f"{BASE}/scores/", payload, format="json")
        assert res.status_code == 400
        assert "already" in res.json()["error"]["message"]

    def test_duration_longer_than_session_rejected(self, api):
        payload = {"token": start(api), "nickname": "ada", "score": 10, "duration_ms": 600_000}
        assert api.post(f"{BASE}/scores/", payload, format="json").status_code == 400

    def test_implausible_score_rejected(self, api):
        token = backdate(start(api), 10)
        payload = {"token": token, "nickname": "ada", "score": 999_999, "duration_ms": 10_000}
        res = api.post(f"{BASE}/scores/", payload, format="json")
        assert res.json()["error"]["code"] == "score_rejected"

    def test_token_for_other_game_rejected(self, api):
        other = api.post("/api/v1/public/games/pop-the-bugs/session/").json()["token"]
        payload = {"token": other, "nickname": "ada", "score": 1, "duration_ms": 0}
        assert api.post(f"{BASE}/scores/", payload, format="json").status_code == 400

    def test_hidden_scores_excluded_and_reset(self, api, owner_api):
        token = backdate(start(api), 10)
        api.post(
            f"{BASE}/scores/",
            {"token": token, "nickname": "rude", "score": 50, "duration_ms": 9_000},
            format="json",
        )
        score = Score.objects.get()
        owner_api.patch(f"/api/v1/admin/scores/{score.pk}/", {"is_hidden": True}, format="json")
        assert api.get(f"{BASE}/leaderboard/").json() == []
        game = Game.objects.get(slug="token-snake")
        assert owner_api.post(f"/api/v1/admin/games/{game.pk}/reset/").json()["deleted"] == 1


def test_validate_submission_unit():
    game = Game(slug="g", max_score_rate=10)
    token = signing.dumps({"g": "g", "t": time.time() - 30, "n": "abc"}, salt=services.SESSION_SALT)
    assert services.validate_submission(game, token, 300, 30_000) == "abc"
    with pytest.raises(services.ScoreRejected):
        services.validate_submission(game, token, 301, 30_000)


@pytest.mark.django_db
def test_road_trip_leaderboard_accepts_a_realistic_drive(api):
    """A full ~4 minute drive scoring ~1000 points must pass the plausibility check."""
    token = backdate(api.post("/api/v1/public/games/road-trip/session/").json()["token"], 250)
    payload = {"token": token, "nickname": "driver", "score": 1000, "duration_ms": 240_000}
    res = api.post("/api/v1/public/games/road-trip/scores/", payload, format="json")
    assert res.status_code == 201, res.json()
    assert res.json()["rank"] == 1
