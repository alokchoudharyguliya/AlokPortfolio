/** Skills: groups on top, then the skills of the selected group. */
import { useState } from "react";

import { useAdminList } from "@/api/admin";
import type { SkillCategory } from "@/api/types";
import formStyles from "@/ui/form/Form.module.css";

import styles from "../Dashboard.module.css";
import { ResourcePage } from "./ResourcePage";

export function SkillsPage() {
  const groups = useAdminList<SkillCategory>("skill-categories");
  const [selected, setSelected] = useState<number | null>(null);
  const groupId = selected ?? groups.data?.[0]?.id ?? null;

  return (
    <div className={styles.stack}>
      <ResourcePage resource="skill-categories" title="Skills" intro="Groups appear in this order on the site." />
      {groupId ? (
        <section className={styles.stack}>
          <label className={formStyles.field} style={{ maxWidth: "20rem" }}>
            <span className={formStyles.label}>Show skills in</span>
            <select className={formStyles.select} value={groupId} onChange={(e) => setSelected(Number(e.target.value))}>
              {groups.data?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <ResourcePage
            key={groupId}
            resource="skills"
            embedded
            title={`Skills in ${groups.data?.find((g) => g.id === groupId)?.name ?? "group"}`}
            query={{ category: groupId }}
            createDefaults={{ category: groupId }}
          />
        </section>
      ) : null}
    </div>
  );
}
