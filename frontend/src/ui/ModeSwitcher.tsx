/**
 * Presentation-mode switcher (Simple / Terminal / 3D). Mode-agnostic: every
 * mode's chrome renders this same component. Unavailable modes are listed but
 * disabled with the reason, so visitors know what's coming.
 */
import clsx from "clsx";
import type { ModeId } from "@/api/types";
import { pressFeedback } from "@/lib/motion/anime";
import { usePreferences } from "@/lib/preferences/PreferencesProvider";
import { MODE_ORDER, MODES } from "@/modes/registry";

import { Icon } from "./Icon";
import styles from "./Switchers.module.css";

export function ModeSwitcher({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = usePreferences();

  const choose = (id: ModeId, el: HTMLElement) => {
    pressFeedback(el);
    if (id !== mode) setMode(id);
  };

  return (
    <div className={clsx(styles.segmented, compact && styles.compact)} role="radiogroup" aria-label="Presentation mode">
      {MODE_ORDER.map((id) => {
        const def = MODES[id];
        const unsupported = def.isSupported && !def.isSupported();
        const disabled = !def.implemented || unsupported;
        const note = !def.implemented ? "coming soon" : unsupported ? "not supported on this device" : def.description;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            aria-disabled={disabled || undefined}
            className={styles.segment}
            title={`${def.label} — ${note}`}
            onClick={(e) => !disabled && choose(id, e.currentTarget)}
          >
            <Icon name={def.icon} size={16} />
            <span className={compact ? "visually-hidden" : undefined}>{def.label}</span>
            {!def.implemented ? <span className={styles.soon}>soon</span> : null}
          </button>
        );
      })}
    </div>
  );
}
