/** Dashboard home: a few counters that link to where action is needed. */
import { Link } from "react-router-dom";

import { useOverview } from "@/api/admin";

import styles from "../Dashboard.module.css";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export function OverviewPage() {
  const overview = useOverview();
  const o = overview.data;

  return (
    <section className={styles.stack}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Overview</h1>
          <p className={styles.pageIntro}>
            Edit content here, or open the site and switch on <strong>Edit page</strong> to change things in place.
          </p>
        </div>
      </div>
      {o ? (
        <div className={styles.tiles}>
          <Link to="/sudo/inbox" className={styles.tile}>
            <span className={styles.tileLabel}>Unread messages</span>
            <span className={styles.tileValue}>{compact.format(o.messages_unread)}</span>
          </Link>
          <Link to="/sudo/analytics" className={styles.tile}>
            <span className={styles.tileLabel}>Visits, last 7 days</span>
            <span className={styles.tileValue}>{compact.format(o.views_7d)}</span>
            <span className={styles.tileNote}>{compact.format(o.visitors_7d)} unique visitor-days</span>
          </Link>
          <Link to="/sudo/projects" className={styles.tile}>
            <span className={styles.tileLabel}>Projects published</span>
            <span className={styles.tileValue}>
              {o.projects_published}
              <span className={styles.tileNote}> of {o.projects}</span>
            </span>
          </Link>
          <Link to="/sudo/posts" className={styles.tile}>
            <span className={styles.tileLabel}>Draft posts</span>
            <span className={styles.tileValue}>{o.posts_draft}</span>
            <span className={styles.tileNote}>{o.posts} posts in total</span>
          </Link>
        </div>
      ) : (
        <p className={styles.muted}>Loading…</p>
      )}
    </section>
  );
}
