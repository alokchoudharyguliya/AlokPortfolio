/**
 * ShellProvider — the Terminal's state machine.
 *
 *   input line ──► parseLine ──► findCommand ──► command.run(ctx) ──► Entry (transcript)
 *                                   ▲                  │
 *      section shortcuts (`projects`)                  └─► ctx.ask(): multi-step prompt (e.g. `message`)
 *
 * It owns the transcript, the working directory, command history and the
 * active prompt, and adapts the app's hooks (router, query client, sudo,
 * preferences) into the plain `CommandContext` that commands receive. Commands
 * therefore stay free of hooks and are easy to read, test and extend.
 *
 * `live` always holds the latest values; handlers read it at call time so that
 * long-lived output (e.g. tappable chips from earlier commands) never acts on
 * stale state.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useLogout, useMe } from "@/api/auth";
import type { Bootstrap } from "@/api/types";
import { track } from "@/lib/analytics";
import { usePreferences } from "@/lib/preferences/PreferencesProvider";
import { useSudo } from "@/sudo/SudoProvider";

import { COMMANDS, completionSpec, findCommand } from "../commands";
import { complete } from "./complete";
import { ShellContext } from "./context";
import type { ShellApi } from "./context";
import { buildFs, formatPath, lookup } from "./fs";
import type { Path } from "./fs";
import { Cmd, describeError, ErrorLine } from "./output";
import { absPath } from "./render";
import { closest, parseLine } from "./parse";
import type { ParsedLine } from "./parse";
import type { Command, CommandContext, Entry, PromptStep, Suggestion } from "./types";

interface Question {
  steps: PromptStep[];
  index: number;
  answers: Record<string, string>;
  done: (answers: Record<string, string>) => ReactNode | Promise<ReactNode>;
}

const isPromise = (v: unknown): v is Promise<ReactNode> => typeof (v as Promise<unknown> | undefined)?.then === "function";

/** Split "guest@alok" into user and host; owners see "root" instead of the guest name. */
function promptParts(hostname: string, isOwner: boolean) {
  const [user, host] = hostname.includes("@") ? hostname.split("@", 2) : ["guest", hostname];
  return { user: isOwner ? "root" : user, host };
}

export function ShellProvider({ bootstrap, children }: { bootstrap: Bootstrap; children: ReactNode }) {
  const qc = useQueryClient();
  const routerNavigate = useNavigate();
  const prefs = usePreferences();
  const { isOwner, editing, setEditing, openEditor } = useSudo();
  const me = useMe();
  const logout = useLogout();

  const root = useMemo(() => buildFs(bootstrap, editing), [bootstrap, editing]);
  const [cwdState, setCwd] = useState<Path>([]);
  // If the directory disappears (e.g. the owner hides its last item), fall back to home.
  const cwd = useMemo(() => (lookup(root, cwdState)?.type === "dir" ? cwdState : []), [root, cwdState]);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [history, setHistory] = useState<string[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const nextId = useRef(1);

  const { user, host } = promptParts(bootstrap.site.terminal_hostname || "guest@portfolio", isOwner);
  const prompt = `${user}@${host}:${formatPath(cwd)}${isOwner ? "#" : "$"}`;

  // Latest values for handlers (see file header). A layout effect runs before
  // child effects, so route views can call `run` during their first mount.
  const live = useRef({ bootstrap, root, cwd, history, isOwner, editing, username: me.data?.user?.username ?? null, prefs, prompt });
  useLayoutEffect(() => {
    live.current = { bootstrap, root, cwd, history, isOwner, editing, username: me.data?.user?.username ?? null, prefs, prompt };
  });

  const append = useCallback((entry: Omit<Entry, "id">) => {
    const id = nextId.current++;
    setEntries((list) => [...list, { ...entry, id }]);
    return id;
  }, []);
  const settle = useCallback((id: number, out: ReactNode) => {
    setEntries((list) => list.map((e) => (e.id === id ? { ...e, out, pending: false } : e)));
  }, []);

  /** Show the result of a command (sync or async) as a transcript entry. */
  const present = useCallback(
    (entry: { prompt: string | null; line: string | null }, produce: () => ReactNode | Promise<ReactNode>) => {
      let result: ReactNode | Promise<ReactNode>;
      try {
        result = produce();
      } catch (err) {
        result = <ErrorLine>{describeError(err)}</ErrorLine>;
      }
      if (isPromise(result)) {
        const id = append({ ...entry, out: null, pending: true });
        result.then(
          (out) => settle(id, out),
          (err: unknown) => settle(id, <ErrorLine>{describeError(err)}</ErrorLine>),
        );
      } else {
        append({ ...entry, out: result, pending: false });
      }
    },
    [append, settle],
  );

  const runRef = useRef<(line: string) => void>(() => {});

  const makeContext = useCallback(
    (parsed: ParsedLine): CommandContext => {
      const L = live.current;
      return {
        parsed,
        bootstrap: L.bootstrap,
        root: L.root,
        cwd: L.cwd,
        history: L.history,
        commands: COMMANDS,
        isOwner: L.isOwner,
        editing: L.editing,
        username: L.username,
        qc,
        setCwd,
        navigate: (to) => routerNavigate(to, { state: { fromShell: true } }),
        run: (line) => runRef.current(line),
        clear: () => {
          setEntries([]);
          setShowWelcome(false);
        },
        ask: (steps, done) => setQuestion({ steps, index: 0, answers: {}, done }),
        prefs: { mode: L.prefs.mode, theme: L.prefs.theme, setMode: L.prefs.setMode, setTheme: L.prefs.setTheme },
        sudo: {
          setEditing,
          openEditor,
          logout: async () => {
            await logout.mutateAsync();
          },
        },
      };
    },
    [qc, routerNavigate, setEditing, openEditor, logout],
  );

  const run = useCallback(
    (line: string) => {
      const L = live.current;
      const text = line.trim();
      const echo = { prompt: L.prompt, line: text };
      if (!text) {
        append({ ...echo, out: null, pending: false });
        return;
      }
      setHistory((h) => (h[h.length - 1] === text ? h : [...h, text]));

      const parsed = parseLine(text);
      if (!parsed) return;
      let command: Command | undefined = findCommand(parsed.name);

      // `projects` ≙ `cat projects`, `projects foo` ≙ `cat projects/foo`.
      if (!command && L.root.children.some((n) => n.name === parsed.name)) {
        command = findCommand("cat");
        const args = parsed.args.length ? parsed.args.map((a) => `${parsed.name}/${a}`) : [parsed.name];
        parsed.tokens = args;
        parsed.args = args;
      }

      track("terminal_command", { command: command?.name ?? "unknown" });

      if (!command) {
        const guess = closest(parsed.name, [...completionSpec(L.root, L.isOwner).commands]);
        present(echo, () => (
          <ErrorLine>
            {parsed.name}: command not found.
            {guess ? (
              <>
                {" "}
                Did you mean <Cmd cmd={guess}>{guess}</Cmd>?
              </>
            ) : (
              <>
                {" "}
                Try <Cmd cmd="help">help</Cmd>.
              </>
            )}
          </ErrorLine>
        ));
        return;
      }
      if (command.ownerOnly && !L.isOwner) {
        present(echo, () => (
          <ErrorLine>
            {command!.name}: permission denied — owner only. <Cmd cmd="sudo login">sudo login</Cmd>
          </ErrorLine>
        ));
        return;
      }
      const cmd = command;
      present(echo, () => cmd.run(makeContext(parsed)));
    },
    [append, makeContext, present],
  );
  useLayoutEffect(() => {
    runRef.current = run;
  }, [run]);

  const answer = useCallback(
    (value: string) => {
      if (!question) return;
      const step = question.steps[question.index];
      const text = value.trim();
      const echo = { prompt: `${step.label}:`, line: step.secret ? "•".repeat(text.length) : text };
      if (!text && !step.optional) {
        append({ ...echo, out: <ErrorLine>This one is required (Ctrl+C to cancel).</ErrorLine>, pending: false });
        return;
      }
      append({ ...echo, out: null, pending: false });
      const answers = { ...question.answers, [step.key]: text };
      if (question.index + 1 < question.steps.length) {
        setQuestion({ ...question, index: question.index + 1, answers });
      } else {
        setQuestion(null);
        present({ prompt: null, line: null }, () => question.done(answers));
      }
    },
    [append, present, question],
  );

  const submit = useCallback((line: string) => (question ? answer(line) : run(line)), [answer, question, run]);

  const cancel = useCallback(() => {
    if (!question) return;
    append({ prompt: `${question.steps[question.index].label}:`, line: "^C", out: null, pending: false });
    setQuestion(null);
  }, [append, question]);

  const spec = useMemo(() => completionSpec(root, isOwner), [root, isOwner]);
  const completeLine = useCallback((line: string) => complete(line, cwd, root, spec), [cwd, root, spec]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const dir = lookup(root, cwd);
    if (dir?.type !== "dir") return [];
    if (!cwd.length) {
      return [
        ...root.children.slice(0, 8).map((n) => ({ label: n.name, cmd: n.name })),
        { label: "help", cmd: "help" },
        { label: "theme", cmd: "theme toggle" },
      ];
    }
    return [
      { label: "cd ..", cmd: "cd .." },
      ...dir.children.slice(0, 10).map((n) => ({ label: n.name, cmd: `cat ${absPath(n.path)}` })),
    ];
  }, [root, cwd]);

  const clearAll = useCallback(() => {
    setEntries([]);
    setShowWelcome(false);
  }, []);

  const api = useMemo<ShellApi>(
    () => ({
      entries,
      showWelcome,
      question: question ? question.steps[question.index].label : null,
      prompt,
      history,
      cwd,
      root,
      suggestions,
      submit,
      run,
      cancel,
      complete: completeLine,
      clear: clearAll,
    }),
    [entries, showWelcome, question, prompt, history, cwd, root, suggestions, submit, run, cancel, completeLine, clearAll],
  );

  return <ShellContext.Provider value={api}>{children}</ShellContext.Provider>;
}
