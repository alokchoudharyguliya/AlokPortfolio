/** Owner inbox: filter, read, star, archive, delete, reply by email. */
import { useEffect, useState } from "react";

import { useAdminMutations, useAdminPage, useMarkAllRead } from "@/api/admin";
import type { Message } from "@/api/types";
import { fullDate, relativeTime } from "@/domain/format";
import { Button, LinkButton } from "@/ui/Button";
import { useToast } from "@/ui/Toast";

import styles from "../Dashboard.module.css";

const FILTERS = {
  inbox: { is_archived: "false" },
  starred: { is_starred: "true" },
  archived: { is_archived: "true" },
} as const;

type Filter = keyof typeof FILTERS;

export function InboxPage() {
  const [filter, setFilter] = useState<Filter>("inbox");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const list = useAdminPage<Message>("messages", { ...FILTERS[filter], page });
  const { update, remove } = useAdminMutations<Message>("messages");
  const markAll = useMarkAllRead();
  const toast = useToast();
  const open = list.data?.results.find((m) => m.id === openId) ?? null;

  // Opening a message marks it read.
  useEffect(() => {
    if (open && !open.is_read) update.mutate({ id: open.id, patch: { is_read: true } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.id]);

  const flag = (m: Message, patch: Partial<Message>, message: string) =>
    update.mutate({ id: m.id, patch }, { onSuccess: () => toast(message, "success") });

  return (
    <section className={styles.stack}>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Inbox</h1>
        <div className={styles.toolbar}>
          <div className={styles.segmentedFilter} role="group" aria-label="Filter messages">
            {(Object.keys(FILTERS) as Filter[]).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => { setFilter(f); setPage(1); setOpenId(null); }}>
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <Button size="sm" variant="ghost" icon="check" loading={markAll.isPending} onClick={() => markAll.mutate()}>
            Mark all read
          </Button>
        </div>
      </div>

      <div className={styles.split}>
        <div className={styles.rows}>
          {list.data?.results.length === 0 ? <p className={styles.panel}>No messages here.</p> : null}
          {list.data?.results.map((m) => (
            <button key={m.id} type="button" className={styles.listButton} aria-current={m.id === openId}
              data-unread={!m.is_read} onClick={() => setOpenId(m.id)}>
              <span className={styles.rowTitle}>
                {!m.is_read ? <span className={styles.unreadDot} aria-label="Unread" /> : null}
                {m.name}
                {m.is_starred ? " ★" : ""}
              </span>
              <span className={styles.rowSub}>{m.subject || m.body.slice(0, 80)}</span>
              <span className={styles.rowSub}>{relativeTime(m.created_at)}</span>
            </button>
          ))}
          {list.data && (list.data.next || list.data.previous) ? (
            <div className={styles.row}>
              <Button size="sm" disabled={!list.data.previous} onClick={() => setPage((p) => p - 1)}>Newer</Button>
              <Button size="sm" disabled={!list.data.next} onClick={() => setPage((p) => p + 1)}>Older</Button>
            </div>
          ) : null}
        </div>

        {open ? (
          <article className={`${styles.panel} ${styles.stack}`}>
            <header>
              <h2>{open.subject || "(no subject)"}</h2>
              <p className={styles.muted}>
                {open.name} &lt;{open.email}&gt; — {fullDate(open.created_at)}
                {open.source_mode ? `, sent from ${open.source_mode} mode` : ""}
              </p>
            </header>
            <p className={styles.messageBody}>{open.body}</p>
            <div className={styles.toolbar}>
              <LinkButton variant="primary" icon="mail"
                href={`mailto:${open.email}?subject=${encodeURIComponent(`Re: ${open.subject || "your message"}`)}`}>
                Reply by email
              </LinkButton>
              <Button icon="star" onClick={() => flag(open, { is_starred: !open.is_starred }, open.is_starred ? "Unstarred" : "Starred")}>
                {open.is_starred ? "Unstar" : "Star"}
              </Button>
              <Button icon="archive" onClick={() => { flag(open, { is_archived: !open.is_archived }, open.is_archived ? "Moved to inbox" : "Archived"); setOpenId(null); }}>
                {open.is_archived ? "Move to inbox" : "Archive"}
              </Button>
              <Button variant="danger" icon="trash" onClick={() => {
                if (!window.confirm("Delete this message permanently?")) return;
                remove.mutate(open.id, { onSuccess: () => { toast("Deleted", "success"); setOpenId(null); } });
              }}>
                Delete
              </Button>
            </div>
          </article>
        ) : (
          <p className={styles.muted}>Select a message to read it.</p>
        )}
      </div>
    </section>
  );
}
