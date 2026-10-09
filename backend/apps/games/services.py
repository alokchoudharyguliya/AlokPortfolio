import secrets
import time

from django.core import signing

SESSION_SALT = "games.session"
SESSION_MAX_AGE = 3 * 60 * 60  # a session token is valid for 3 hours
DURATION_SLACK_S = 5  # network / clock tolerance
SCORE_FLOOR = 100  # minimum allowance so very short games are never rejected


def start_session(game) -> str:
    return signing.dumps(
        {"g": game.slug, "t": time.time(), "n": secrets.token_hex(12)}, salt=SESSION_SALT
    )


class ScoreRejected(Exception):
    pass


def validate_submission(game, token: str, score: int, duration_ms: int) -> str:
    """Return the session nonce if plausible, else raise ScoreRejected."""
    try:
        data = signing.loads(token, salt=SESSION_SALT, max_age=SESSION_MAX_AGE)
    except signing.BadSignature as exc:
        raise ScoreRejected("Game session expired. Play again to submit.") from exc
    if data.get("g") != game.slug:
        raise ScoreRejected("Session belongs to another game.")
    elapsed = time.time() - float(data["t"])
    claimed = duration_ms / 1000
    if claimed > elapsed + DURATION_SLACK_S:
        raise ScoreRejected("Duration is longer than the session.")
    allowance = max(SCORE_FLOOR, game.max_score_rate * max(claimed, 1.0))
    if score > allowance:
        raise ScoreRejected("Score is not plausible.")
    return data["n"]
