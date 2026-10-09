import { useRef } from "react";

import { swapIcon } from "@/lib/motion/anime";
import { usePreferences } from "@/lib/preferences/PreferencesProvider";

import { Icon } from "./Icon";
import styles from "./Switchers.module.css";

/** Dark/light toggle; the icon shows the theme you'll switch TO. */
export function ThemeToggle() {
  const { theme, toggleTheme } = usePreferences();
  const iconRef = useRef<HTMLSpanElement>(null);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => {
        toggleTheme();
        requestAnimationFrame(() => swapIcon(iconRef.current));
      }}
    >
      <span ref={iconRef} className={styles.iconWrap}>
        <Icon name={next === "light" ? "sun" : "moon"} />
      </span>
    </button>
  );
}
