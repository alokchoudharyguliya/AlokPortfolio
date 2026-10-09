import { Button } from "@/ui/Button";

import styles from "./BootScreen.module.css";

/** Shown while the bootstrap payload or a mode's code is loading. */
export function BootScreen({ error, onRetry }: { error?: boolean; onRetry?: () => void }) {
  if (error) {
    return (
      <main className={styles.screen}>
        <p>The site couldn't load its content. Check your connection and try again.</p>
        {onRetry ? (
          <Button variant="primary" icon="refresh" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </main>
    );
  }
  return (
    <main className={styles.screen} aria-busy="true">
      <span className={styles.bar} aria-hidden />
      <span className="visually-hidden">Loading</span>
    </main>
  );
}
