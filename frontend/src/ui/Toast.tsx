/**
 * Minimal toast system: `useToast()(message, tone)`. Announced politely to
 * screen readers via an aria-live region. Used for save/publish confirmations
 * and API errors across the dashboard, inline editor and public forms.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Icon } from "./Icon";
import styles from "./Toast.module.css";

type Tone = "info" | "success" | "error";
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

type Notify = (message: string, tone?: Tone) => void;

const ToastContext = createContext<Notify>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback<Notify>(
    (message, tone = "info") => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-3), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 7000 : 3500);
    },
    [dismiss],
  );

  const value = useMemo(() => notify, [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.region} aria-live="polite" role="status">
        {items.map((t) => (
          <div key={t.id} className={styles.toast} data-tone={t.tone}>
            <Icon name={t.tone === "error" ? "close" : "check"} />
            <span>{t.message}</span>
            <button className={styles.dismiss} onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Notify {
  return useContext(ToastContext);
}
