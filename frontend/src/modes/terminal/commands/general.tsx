/** Everyday commands: help, theme, mode, message, whoami, sudo, history, clear … */
import type { ReactNode } from "react";

import { submitContact } from "@/api/public";
import { isModeAvailable, MODE_ORDER, MODES } from "@/modes/registry";

import styles from "../Terminal.module.css";
import { Cmd, describeError, ErrorLine, Heading, Hint, Muted, OkLine, Rows } from "../shell/output";
import type { Command, CommandContext } from "../shell/types";
import { versionHistory } from "./owner";

/** Banner printed when the terminal boots. */
export function Welcome({ ctx }: { ctx: Pick<CommandContext, "bootstrap" | "root"> }) {
  const { profile } = ctx.bootstrap;
  const top = ctx.root.children.slice(0, 7);
  return (
    <section className={styles.article}>
      <Heading meta={profile.headline}>{profile.full_name}</Heading>
      {profile.tagline ? <p>{profile.tagline}</p> : null}
      <Hint>
        Type <Cmd cmd="help">help</Cmd> for commands, press <kbd>Tab</kbd> to complete, or tap a suggestion below.
      </Hint>
      {top.length ? (
        <Hint>
          Start with{" "}
          {top.map((n, i) => (
            <span key={n.name}>
              {i ? ", " : ""}
              <Cmd cmd={n.name}>{n.name}</Cmd>
            </span>
          ))}
          .
        </Hint>
      ) : null}
    </section>
  );
}

const help: Command = {
  name: "help",
  aliases: ["?", "man"],
  summary: "Show commands, or details for one",
  usage: "help [command]",
  bare: true,
  args: () => null,
  run(ctx) {
    const want = ctx.parsed.args[0]?.toLowerCase();
    if (want) {
      const cmd = ctx.commands.find((c) => c.name === want || c.aliases?.includes(want));
      if (!cmd) return <ErrorLine>help: no command named {want}.</ErrorLine>;
      return (
        <section>
          <Heading meta={cmd.summary}>{cmd.name}</Heading>
          <Rows
            rows={[
              ["usage", <code key="u">{cmd.usage ?? cmd.name}</code>],
              ...(cmd.aliases?.length ? ([["aliases", cmd.aliases.join(", ")]] as [string, ReactNode][]) : []),
            ]}
          />
        </section>
      );
    }

    const visible = ctx.commands.filter((c) => !c.ownerOnly);
    const group = (names: string[]) =>
      names.flatMap((n) => visible.filter((c) => c.name === n)).map((c): [string, ReactNode] => [
        c.usage ?? c.name,
        <>
          {c.bare ? <Cmd cmd={c.name}>run</Cmd> : null} {c.summary}
        </>,
      ]);
    const owner = ctx.commands.filter((c) => c.ownerOnly);

    return (
      <section>
        <Heading meta="Everything below is a real command. Names in the output are tappable too.">Commands</Heading>
        <p className={styles.group}>Read</p>
        <p>
          {ctx.root.children.map((n) => (
            <span key={n.name}>
              <Cmd cmd={n.name}>{n.name}</Cmd>{" "}
            </span>
          ))}
        </p>
        <p className={styles.group}>Move around</p>
        <Rows rows={group(["ls", "cd", "pwd", "cat", "tree", "open"])} />
        <p className={styles.group}>Site</p>
        <Rows rows={group(["message", "theme", "mode", "whoami", "history", "clear", "exit", "help"])} />
        {ctx.isOwner ? (
          <>
            <p className={styles.group}>Owner</p>
            <Rows
              rows={owner.map((c): [string, ReactNode] => [c.usage ?? c.name, c.summary])}
            />
          </>
        ) : (
          <Hint>
            Site owner? Run <Cmd cmd="sudo login">sudo login</Cmd>.
          </Hint>
        )}
      </section>
    );
  },
};

const clear: Command = {
  name: "clear",
  aliases: ["cls"],
  summary: "Clear the screen (Ctrl+L)",
  bare: true,
  run(ctx) {
    ctx.clear();
    return null;
  },
};

const echo: Command = {
  name: "echo",
  summary: "Print text",
  usage: "echo <text>",
  run: (ctx) => ctx.parsed.tokens.join(" "),
};

const date: Command = {
  name: "date",
  summary: "Print the current date and time",
  bare: true,
  run: () => new Date().toString(),
};

const whoami: Command = {
  name: "whoami",
  summary: "Who the shell thinks you are",
  bare: true,
  run(ctx) {
    if (ctx.isOwner) {
      return (
        <p>
          root <Muted>(owner session{ctx.username ? `, ${ctx.username}` : ""})</Muted>
        </p>
      );
    }
    return (
      <p>
        guest <Muted>— a visitor. For the person behind the site, run </Muted>
        <Cmd cmd="cat about">cat about</Cmd>
      </p>
    );
  },
};

const theme: Command = {
  name: "theme",
  summary: "Switch between dark and light",
  usage: "theme [dark|light|toggle]",
  bare: true,
  args: () => ["dark", "light", "toggle"],
  run(ctx) {
    const want = ctx.parsed.args[0]?.toLowerCase();
    if (!want) {
      return (
        <p>
          Current theme: {ctx.prefs.theme}. Try <Cmd cmd="theme toggle">theme toggle</Cmd>.
        </p>
      );
    }
    const next = want === "toggle" ? (ctx.prefs.theme === "dark" ? "light" : "dark") : want;
    if (next !== "dark" && next !== "light") return <ErrorLine>theme: choose dark, light or toggle.</ErrorLine>;
    ctx.prefs.setTheme(next);
    return <OkLine>Theme set to {next}.</OkLine>;
  },
};

const mode: Command = {
  name: "mode",
  summary: "Switch presentation mode",
  usage: "mode [simple|terminal|3d|drive]",
  bare: true,
  args: () => MODE_ORDER,
  run(ctx) {
    const want = ctx.parsed.args[0]?.toLowerCase();
    if (!want) {
      return (
        <Rows
          rows={MODE_ORDER.map((id): [string, ReactNode] => [
            id,
            <>
              {MODES[id].description}{" "}
              {id === ctx.prefs.mode ? (
                <Muted>(current)</Muted>
              ) : isModeAvailable(id) ? (
                <Cmd cmd={`mode ${id}`}>switch</Cmd>
              ) : (
                <Muted>(coming soon)</Muted>
              )}
            </>,
          ])}
        />
      );
    }
    const id = MODE_ORDER.find((m) => m === want);
    if (!id) return <ErrorLine>mode: unknown mode "{want}". Choose {MODE_ORDER.join(", ")}.</ErrorLine>;
    if (id === ctx.prefs.mode) return <Muted>Already in {id} mode.</Muted>;
    if (!isModeAvailable(id)) return <ErrorLine>mode: {id} isn't available yet{id === "3d" || id === "drive" ? " (or this device lacks WebGL)" : ""}.</ErrorLine>;
    ctx.prefs.setMode(id);
    return <OkLine>Switching to {id} mode…</OkLine>;
  },
};

const exit: Command = {
  name: "exit",
  aliases: ["quit"],
  summary: "Leave the terminal and return to Simple mode",
  bare: true,
  run(ctx) {
    ctx.prefs.setMode("simple");
    return <Muted>logout</Muted>;
  },
};

const message: Command = {
  name: "message",
  aliases: ["msg", "send"],
  summary: "Send me a message (asks a few questions)",
  bare: true,
  run(ctx) {
    if (!ctx.bootstrap.site.contact_enabled) {
      return <ErrorLine>Messages are switched off right now. Try <Cmd cmd="cat contact">cat contact</Cmd> for other ways to reach me.</ErrorLine>;
    }
    ctx.ask(
      [
        { key: "name", label: "Your name" },
        { key: "email", label: "Your email" },
        { key: "subject", label: "Subject (optional)", optional: true },
        { key: "body", label: "Message (10+ characters)" },
      ],
      async (a) => {
        try {
          await submitContact({
            name: a.name,
            email: a.email,
            subject: a.subject ?? "",
            body: a.body,
            source_mode: "terminal",
            website: "",
          });
          return <OkLine>Message sent. Thanks — I'll reply to {a.email}.</OkLine>;
        } catch (err) {
          return (
            <ErrorLine>
              Couldn't send: {describeError(err)} <Cmd cmd="message">Try again</Cmd>
            </ErrorLine>
          );
        }
      },
    );
    return <Muted>Ctrl+C cancels at any question.</Muted>;
  },
};

const history: Command = {
  name: "history",
  summary: "Recent commands — or, as owner, a content item's edit history",
  usage: "history [path]",
  bare: true,
  args: () => "path",
  run(ctx) {
    if (ctx.parsed.args.length) {
      if (!ctx.isOwner) return <ErrorLine>history: edit history is for the site owner. <Cmd cmd="sudo login">sudo login</Cmd></ErrorLine>;
      return versionHistory(ctx);
    }
    if (!ctx.history.length) return <Muted>No commands yet.</Muted>;
    return (
      <ol className={styles.history}>
        {ctx.history.map((h, i) => (
          <li key={i}>
            <Muted>{String(i + 1).padStart(3)}</Muted> <Cmd cmd={h}>{h}</Cmd>
          </li>
        ))}
      </ol>
    );
  },
};

const sudo: Command = {
  name: "sudo",
  summary: "Owner access: login, edit on/off, dashboard, logout",
  usage: "sudo <login|edit on|edit off|dashboard|logout>",
  bare: true,
  args: (i) => (i === 0 ? ["login", "edit", "dashboard", "logout"] : i === 1 ? ["on", "off"] : null),
  async run(ctx) {
    const [sub, arg] = ctx.parsed.args.map((a) => a.toLowerCase());
    if (!sub) {
      return ctx.isOwner ? (
        <Rows
          rows={[
            ["status", <>owner session{ctx.username ? ` (${ctx.username})` : ""}</>],
            ["draft view", ctx.editing ? <>on <Cmd cmd="sudo edit off">turn off</Cmd></> : <>off <Cmd cmd="sudo edit on">turn on</Cmd></>],
            ["dashboard", <Cmd key="d" cmd="sudo dashboard">sudo dashboard</Cmd>],
          ]}
        />
      ) : (
        <Hint>
          Owner tools need a login: <Cmd cmd="sudo login">sudo login</Cmd>
        </Hint>
      );
    }
    switch (sub) {
      case "login":
        if (ctx.isOwner) return <Muted>Already logged in as owner.</Muted>;
        ctx.navigate("/sudo/login?next=/");
        return <Muted>Opening the owner login…</Muted>;
      case "dashboard":
        if (!ctx.isOwner) return <ErrorLine>sudo: permission denied. <Cmd cmd="sudo login">sudo login</Cmd></ErrorLine>;
        ctx.navigate("/sudo");
        return <Muted>Opening the dashboard…</Muted>;
      case "logout":
        if (!ctx.isOwner) return <Muted>Not logged in.</Muted>;
        await ctx.sudo.logout();
        return <OkLine>Owner session ended.</OkLine>;
      case "edit":
        if (!ctx.isOwner) return <ErrorLine>sudo: permission denied. <Cmd cmd="sudo login">sudo login</Cmd></ErrorLine>;
        if (arg !== "on" && arg !== "off") return <ErrorLine>sudo edit: say on or off.</ErrorLine>;
        ctx.sudo.setEditing(arg === "on");
        return arg === "on" ? (
          <OkLine>Draft view on — unpublished items now appear in <code>ls</code>, and can be edited or published.</OkLine>
        ) : (
          <OkLine>Draft view off.</OkLine>
        );
      default:
        return <ErrorLine>sudo: unknown option "{sub}". Try <Cmd cmd="sudo">sudo</Cmd>.</ErrorLine>;
    }
  },
};

export const GENERAL_COMMANDS: Command[] = [help, clear, echo, date, whoami, theme, mode, exit, message, history, sudo];
