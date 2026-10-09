/** Games: enable/disable each game and moderate its leaderboard. */
import { useState } from "react";

import { useAdminList, useAdminMutations, useResetLeaderboard } from "@/api/admin";
import type { Game, ScoreRow } from "@/api/types";
import { relativeTime } from "@/domain/format";
import { Button } from "@/ui/Button";
import { Toggle } from "@/ui/form/inputs";
import { useToast } from "@/ui/Toast";

import styles from "../Dashboard.module.css";

export function GamesPage() {
  const games = useAdminList<Game>("games");
  const gameMutations = useAdminMutations<Game>("games");
  const [slug, setSlug] = useState<string | null>(null);
  const active = games.data?.find((g) => g.slug === slug) ?? games.data?.[0];
  const scores = useAdminList<ScoreRow>("scores", { game__slug: active?.slug }, Boolean(active));
  const scoreMutations = useAdminMutations<ScoreRow>("scores");
  const reset = useResetLeaderboard();
  const toast = useToast();

  return (
    <section className={styles.stack}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Games</h1>
          <p className={styles.pageIntro}>Turn games on or off and remove inappropriate leaderboard names.</p>
        </div>
      </div>

      <ul className={styles.rows}>
        {games.data?.map((g) => (
          <li key={g.id} className={styles.row}>
            <button type="button" className={styles.rowMain} onClick={() => setSlug(g.slug)}>
              <span className={styles.rowTitle}>{g.name}</span>
              <span className={styles.rowSub}>{g.description}</span>
            </button>
            <Toggle
              id={`game-${g.id}`}
              checked={g.is_enabled}
              label={g.is_enabled ? "On" : "Off"}
              onChange={(on) => gameMutations.update.mutate({ id: g.id, patch: { is_enabled: on } })}
            />
          </li>
        ))}
      </ul>

      {active ? (
        <section className={styles.stack}>
          <div className={styles.pageHead}>
            <h2>Leaderboard: {active.name}</h2>
            <Button variant="danger" icon="refresh" loading={reset.isPending} onClick={async () => {
              if (!window.confirm(`Delete every score for ${active.name}?`)) return;
              const res = await reset.mutateAsync(active.id);
              toast(`Removed ${res.deleted} scores`, "success");
            }}>
              Reset leaderboard
            </Button>
          </div>
          {scores.data?.length === 0 ? <p className={styles.muted}>No scores yet.</p> : null}
          <ul className={styles.rows}>
            {scores.data?.map((s) => (
              <li key={s.id} className={styles.row} data-hidden={s.is_hidden}>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>{s.nickname}: {s.score}</span>
                  <span className={styles.rowSub}>{relativeTime(s.created_at)}</span>
                </div>
                <Button size="sm" variant="ghost" iconOnly icon={s.is_hidden ? "eyeOff" : "eye"}
                  aria-label={s.is_hidden ? "Show on leaderboard" : "Hide from leaderboard"}
                  onClick={() => scoreMutations.update.mutate({ id: s.id, patch: { is_hidden: !s.is_hidden } })} />
                <Button size="sm" variant="ghost" iconOnly icon="trash" aria-label="Delete score"
                  onClick={() => scoreMutations.remove.mutate(s.id)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
