/**
 * localStorage that never throws (private windows, blocked storage, SSR/tests).
 * Only per-visitor conveniences live here (theme, mode, sound, edit toggle).
 */
export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* storage unavailable: preference simply isn't remembered */
    }
  },
  remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

/** Keys are mirrored in index.html's pre-paint script — keep them in sync. */
export const KEYS = {
  theme: "pf.theme",
  mode: "pf.mode",
  sound: "pf.sound",
  editing: "pf.sudo.editing",
  driveCalm: "pf.drive.calm",
  drivePedals: "pf.drive.pedals",
} as const;
