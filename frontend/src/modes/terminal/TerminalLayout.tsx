/**
 * Terminal mode chrome and the command line itself.
 *
 *   ┌ title bar: prompt • mode switch • theme toggle ┐
 *   │ transcript (welcome, echoed commands, output)   │   ← role="log"
 *   │ prompt ▌                                        │   ← <input>, Tab/↑/↓/Ctrl+L/Ctrl+C
 *   ├ suggestion chips (tappable commands) ───────────┤
 *
 * The shell state lives in ShellProvider; this file is only the view. Route
 * views (views.tsx) render inside the provider as `children` and merely ask
 * the shell to run a command for deep links such as /projects/<slug>.
 */
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import type { Bootstrap } from "@/api/types";
import { useSudo } from "@/sudo/SudoProvider";
import { ModeSwitcher } from "@/ui/ModeSwitcher";
import { ThemeToggle } from "@/ui/ThemeToggle";

import { Welcome } from "./commands/general";
import { useShell } from "./shell/context";
import { ShellProvider } from "./shell/ShellProvider";
import type { Entry } from "./shell/types";
import styles from "./Terminal.module.css";

export default function TerminalLayout({ bootstrap, children }: { bootstrap: Bootstrap; children: ReactNode }) {
  return (
    <ShellProvider bootstrap={bootstrap}>
      <TerminalWindow bootstrap={bootstrap} />
      {children}
    </ShellProvider>
  );
}

const isTouch = () => window.matchMedia("(pointer: coarse)").matches;

function TerminalWindow({ bootstrap }: { bootstrap: Bootstrap }) {
  const sh = useShell();
  const { isOwner } = useSudo();
  const [value, setValue] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  // Position in command history while browsing with ↑/↓ (null = editing a fresh line).
  const [cursor, setCursor] = useState<number | null>(null);
  const draft = useRef("");
  const screenRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Desktop: start ready to type. Touch: don't pop the keyboard over the content.
  useEffect(() => {
    if (!isTouch()) inputRef.current?.focus({ preventScroll: true });
  }, []);

  // Keep the newest output in view, and return focus to the input after a chip tap (desktop).
  useEffect(() => {
    const el = screenRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    const active = document.activeElement;
    if (!isTouch() && active instanceof HTMLButtonElement && el?.contains(active)) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [sh.entries, sh.showWelcome, options]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      sh.clear();
    } else if (e.ctrlKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      sh.cancel();
      setValue("");
      setOptions([]);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      if (sh.question || !sh.history.length) return;
      e.preventDefault();
      if (e.key === "ArrowUp") {
        if (cursor === null) draft.current = value;
        const next = cursor === null ? sh.history.length - 1 : Math.max(0, cursor - 1);
        setCursor(next);
        setValue(sh.history[next]);
      } else if (cursor !== null) {
        const next = cursor + 1;
        if (next >= sh.history.length) {
          setCursor(null);
          setValue(draft.current);
        } else {
          setCursor(next);
          setValue(sh.history[next]);
        }
      }
    } else if (e.key === "Tab" && !e.shiftKey && !sh.question && value.trim()) {
      const result = sh.complete(value);
      // Nothing to complete: let Tab move focus so keyboard users are never trapped.
      if (result.line === value && !result.options.length) return;
      e.preventDefault();
      setValue(result.line);
      setOptions(result.options);
    } else if (e.key === "Escape") {
      setOptions([]);
    }
  };

  const onSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    sh.submit(value);
    setValue("");
    setOptions([]);
    setCursor(null);
  };

  return (
    <div className={styles.shell} data-owner={isOwner}>
      <div className={styles.window}>
        <header className={styles.bar}>
          <span className={styles.dots} aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className={styles.title} title={sh.prompt}>
            {sh.prompt}
          </span>
          <div className={styles.controls}>
            <ModeSwitcher compact />
            <ThemeToggle />
          </div>
        </header>

        <main
          id="main"
          ref={screenRef}
          className={styles.screen}
          onClick={(e) => {
            // Clicking empty space focuses the prompt, but never steals a text selection or a link/chip click.
            if (window.getSelection()?.toString()) return;
            if ((e.target as HTMLElement).closest("a, button")) return;
            inputRef.current?.focus({ preventScroll: true });
          }}
        >
          <h1 className="visually-hidden">{bootstrap.profile.full_name}: interactive terminal</h1>
          <div className={styles.transcript} role="log" aria-live="polite" aria-relevant="additions" aria-label="Terminal output">
            {sh.showWelcome ? <Welcome ctx={{ bootstrap, root: sh.root }} /> : null}
            {sh.entries.map((entry) => (
              <EntryView key={entry.id} entry={entry} />
            ))}
          </div>

          {options.length ? (
            <ul className={styles.hints} aria-label="Completions">
              {options.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          ) : null}

          <form className={styles.inputRow} onSubmit={onSubmit}>
            <label htmlFor="terminal-input" className={styles.prompt}>
              <PromptText text={sh.question ? `${sh.question}:` : sh.prompt} plain={Boolean(sh.question)} />
            </label>
            <input
              id="terminal-input"
              ref={inputRef}
              className={styles.input}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setOptions([]);
                setCursor(null);
              }}
              onKeyDown={onKeyDown}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              aria-label={sh.question ?? "Terminal command"}
            />
          </form>
        </main>

        <nav className={styles.chips} aria-label="Suggested commands">
          {sh.suggestions.map((s) => (
            <button key={s.label} type="button" className={styles.chip} title={`Run: ${s.cmd}`} onClick={() => sh.run(s.cmd)}>
              {s.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

/** `user@host:~/path$` with the user/host and path tinted like a real prompt. */
function PromptText({ text, plain = false }: { text: string; plain?: boolean }) {
  const match = !plain && /^(.+?):(.*?)([$#])$/.exec(text);
  if (!match) return <>{text}</>;
  return (
    <>
      <span className={styles.userHost}>{match[1]}</span>
      <span aria-hidden>:</span>
      <span className={styles.pathText}>{match[2]}</span>
      {match[3]}
    </>
  );
}

function EntryView({ entry }: { entry: Entry }) {
  return (
    <div className={clsx(styles.entry)}>
      {entry.line !== null ? (
        <p className={styles.echo}>
          <span>
            <PromptText text={entry.prompt ?? ""} plain={!/[$#]$/.test(entry.prompt ?? "")} />
          </span>
          <span>{entry.line}</span>
        </p>
      ) : null}
      {entry.pending ? (
        <p className={styles.muted} aria-busy>
          …
        </p>
      ) : entry.out ? (
        <div className={styles.out}>{entry.out}</div>
      ) : null}
    </div>
  );
}
