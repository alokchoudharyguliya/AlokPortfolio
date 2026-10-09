/** Full-page form for a singleton resource (Profile, Site settings). */
import { useId } from "react";

import { useSingleton } from "@/api/admin";
import { getResource } from "@/domain/resources";
import { Button } from "@/ui/Button";
import { useToast } from "@/ui/Toast";

import { ResourceForm } from "../../editor/ResourceForm";
import styles from "../Dashboard.module.css";

export function SingletonPage({ resource, intro }: { resource: string; intro?: string }) {
  const def = getResource(resource);
  const { query, save } = useSingleton<Record<string, unknown>>(def.endpoint);
  const toast = useToast();
  const formId = useId();

  return (
    <section>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>{def.label}</h1>
          {intro ? <p className={styles.pageIntro}>{intro}</p> : null}
        </div>
      </div>
      {query.data ? (
        <>
          <ResourceForm
            key={String(query.data.updated_at)}
            def={def}
            item={query.data}
            formId={formId}
            onSubmit={async (payload) => {
              await save.mutateAsync(payload);
              toast("Saved", "success");
            }}
          />
          <div className={styles.formActions}>
            <Button variant="primary" type="submit" form={formId} loading={save.isPending}>
              Save changes
            </Button>
          </div>
        </>
      ) : (
        <p className={styles.muted}>Loading…</p>
      )}
    </section>
  );
}
