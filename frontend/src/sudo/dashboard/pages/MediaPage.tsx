/** Media library: upload, describe (alt text matters for accessibility), delete. */
import { useState } from "react";

import { useAdminMutations } from "@/api/admin";
import type { MediaAsset } from "@/api/types";
import { fileSize, fullDate } from "@/domain/format";
import { Button, LinkButton } from "@/ui/Button";
import formStyles from "@/ui/form/Form.module.css";
import { useToast } from "@/ui/Toast";

import { MediaGrid, UploadButton } from "../../media/MediaPicker";
import styles from "../Dashboard.module.css";

export function MediaPage() {
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const { update, remove } = useAdminMutations<MediaAsset>("media");
  const toast = useToast();

  return (
    <section className={styles.stack}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Media</h1>
          <p className={styles.pageIntro}>Images and PDFs used across the site. Up to 10 MB per file.</p>
        </div>
        <UploadButton onUploaded={setSelected} />
      </div>

      <div className={styles.split}>
        <MediaGrid onPick={setSelected} selectedId={selected?.id} />
        {selected ? (
          <form
            key={selected.id}
            className={`${styles.panel} ${styles.stack}`}
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const saved = await update.mutateAsync({
                id: selected.id,
                patch: { title: String(form.get("title")), alt_text: String(form.get("alt_text")) },
              });
              setSelected(saved);
              toast("Saved", "success");
            }}
          >
            {selected.kind === "image" ? <img src={selected.url} alt={selected.alt_text} style={{ borderRadius: 8 }} /> : null}
            <p className={styles.muted}>
              {selected.original_name}, {fileSize(selected.size)}
              {selected.width ? `, ${selected.width}×${selected.height}` : ""}, uploaded {fullDate(selected.created_at)}
            </p>
            <label className={formStyles.field}>
              <span className={formStyles.label}>Title</span>
              <input name="title" className={formStyles.input} defaultValue={selected.title} />
            </label>
            <label className={formStyles.field}>
              <span className={formStyles.label}>Alt text</span>
              <input name="alt_text" className={formStyles.input} defaultValue={selected.alt_text}
                placeholder="Describe the image for people who can't see it" />
            </label>
            <div className={styles.toolbar}>
              <Button type="submit" variant="primary" loading={update.isPending}>Save details</Button>
              <LinkButton href={selected.url} target="_blank" rel="noreferrer" icon="external">Open</LinkButton>
              <Button variant="danger" icon="trash" loading={remove.isPending} onClick={async () => {
                if (!window.confirm("Delete this file? Anything using it will show nothing instead.")) return;
                await remove.mutateAsync(selected.id);
                setSelected(null);
                toast("Deleted", "success");
              }}>
                Delete
              </Button>
            </div>
          </form>
        ) : (
          <p className={styles.muted}>Select a file to edit its details.</p>
        )}
      </div>
    </section>
  );
}
