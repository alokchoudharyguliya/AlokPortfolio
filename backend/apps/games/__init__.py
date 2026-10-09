"""
games — game registry, leaderboards and light anti-cheat.

Games themselves run entirely in the browser (frontend/src/games). The backend
only knows *which* games exist (enable/disable from sudo) and stores scores.

Score submission flow
---------------------
1. POST /public/games/<slug>/session/   → {"token": "<signed {game, start, nonce}>"}
2. play …
3. POST /public/games/<slug>/scores/    {token, nickname, score, duration_ms}

The server rejects a score when the token is invalid/expired/reused, when the
claimed duration exceeds the real elapsed time, or when the score exceeds
`game.max_score_rate` × seconds played. This is deliberately "honest-player"
protection — enough to stop trivial curl spam, not a determined cheater.
"""
