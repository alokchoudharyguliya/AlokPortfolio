/**
 * The end of the road: stats, an optional leaderboard entry, and ways onward.
 * Score submission goes through the signed-session API (api/games.ts). Drives that
 * used autopilot, calm mode or the route map aren't ranked, since they don't
 * measure driving; the panel says so instead of silently hiding the form.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@/api/client";
import { ROAD_TRIP, submitScore, useLeaderboard } from "@/api/games";
import type { LeaderboardEntry } from "@/api/games";
import { Button } from "@/ui/Button";
import formStyles from "@/ui/form/Form.module.css";

import type { GameSnapshot } from "./engine/game";
import { clock } from "./engine/score";
import styles from "./Drive.module.css";

export interface FinishPanelProps {
  snap: GameSnapshot;
  /** The game's leaderboard is enabled on this site. */
  leaderboard: boolean;
  /** Signed play-session token (null if the drive never really started). */
  token: string | null;
  /** Reason this drive can't be ranked, or null if it can. */
  unranked: string | null;
  onRestart: () => void;
  onReadAsPage: () => void;
  onBack: () => void;
}

export function FinishPanel({ snap, leaderboard, token, unranked, onRestart, onReadAsPage, onBack }: FinishPanelProps) {
  const qc = useQueryClient();
  const board = useLeaderboard(ROAD_TRIP, leaderboard);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);
  const entries = rows ?? board.data ?? [];
  const canSubmit = leaderboard && token && !unranked && rank === null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await submitScore(ROAD_TRIP, {
        token,
        nickname: name.trim(),
        score: snap.score,
        duration_ms: Math.round(snap.stats.elapsed * 1000),
      });
      setRank(res.rank);
      setRows(res.leaderboard);
      qc.invalidateQueries({ queryKey: ["public", "leaderboard", ROAD_TRIP] });
    } catch (err) {
      setError(err instanceof ApiError ? Object.values(err.fields).flat()[0] ?? err.message : "Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.panel} role="dialog" aria-label="You made it" tabIndex={-1} data-key="finish">
      <div className={styles.panelScroll} data-lenis-prevent>
        <p className={styles.kicker}>Finish</p>
        <h2 className={styles.finishTitle}>You made it.</h2>
        <p className={styles.heroTagline}>That's everything. Thanks for driving through it.</p>

        <dl className={styles.stats}>
          <div>
            <dt>Points</dt>
            <dd>{snap.score}</dd>
          </div>
          <div>
            <dt>Driving time</dt>
            <dd>{clock(snap.stats.elapsed)}</dd>
          </div>
          <div>
            <dt>Cars passed</dt>
            <dd>{snap.stats.passes}</dd>
          </div>
          <div>
            <dt>Boosts</dt>
            <dd>{snap.stats.boosts}</dd>
          </div>
          <div>
            <dt>Crashes</dt>
            <dd>{snap.stats.crashes}</dd>
          </div>
        </dl>

        {leaderboard ? (
          <section className={styles.board} aria-labelledby="board-title">
            <h3 id="board-title" className={styles.menuHead}>
              Leaderboard
            </h3>
            {unranked ? <p className={styles.menuNote}>{unranked}</p> : null}
            {canSubmit ? (
              <form className={styles.nameForm} onSubmit={submit}>
                <label className={formStyles.field}>
                  <span className={formStyles.label}>Name for the board</span>
                  <input className={formStyles.input} value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={24} required autoComplete="nickname" />
                </label>
                <Button type="submit" variant="primary" loading={busy}>
                  Post {snap.score} points
                </Button>
                {error ? <p className={formStyles.error} role="alert">{error}</p> : null}
              </form>
            ) : null}
            {rank !== null ? <p className={styles.menuNote}>You're number {rank}.</p> : null}
            {entries.length ? (
              <ol className={styles.boardList}>
                {entries.map((r, i) => (
                  <li key={`${r.nickname}-${i}`}>
                    <span>{r.nickname}</span>
                    <span>{r.score}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.menuNote}>No scores yet. Be the first.</p>
            )}
          </section>
        ) : null}
      </div>
      <footer className={styles.panelFooter}>
        <Button variant="ghost" size="sm" onClick={onReadAsPage}>
          Read as a page
        </Button>
        <Button size="sm" onClick={onBack}>
          Back to the last gate
        </Button>
        <Button variant="primary" onClick={onRestart}>
          Drive again
        </Button>
      </footer>
    </div>
  );
}
