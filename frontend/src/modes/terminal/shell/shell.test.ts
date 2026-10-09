import type { FieldDef } from "@/domain/resources";
import { getResource } from "@/domain/resources";

import { COMMANDS, completionSpec } from "../commands";
import { makeBootstrap } from "../fixtures";
import { complete } from "./complete";
import { coerceFieldValue, findField } from "./fields";
import { buildFs, formatPath, lookup, normalize, resolve, resourceOf, slugify, walk } from "./fs";
import { closest, distance, parseLine, tokenize } from "./parse";

describe("tokenize / parseLine", () => {
  it("splits on whitespace and honours quotes and escapes", () => {
    expect(tokenize('set projects/x summary "two  words" \'single q\'')).toEqual([
      "set",
      "projects/x",
      "summary",
      "two  words",
      "single q",
    ]);
    expect(tokenize("echo a\\ b")).toEqual(["echo", "a b"]);
    expect(tokenize("   ")).toEqual([]);
    expect(tokenize('echo ""')).toEqual(["echo", ""]);
  });

  it("separates flags from arguments and lowercases the command", () => {
    const p = parseLine("LS -la projects --long");
    expect(p?.name).toBe("ls");
    expect(p?.args).toEqual(["projects"]);
    expect([...(p?.flags ?? [])].sort()).toEqual(["a", "l", "long"]);
    expect(parseLine("")).toBeNull();
  });

  it("keeps negative numbers and dashes in values as arguments", () => {
    expect(parseLine("set x level -5")?.args).toContain("-5");
  });

  it("suggests the closest command within two edits", () => {
    expect(distance("kitten", "sitting")).toBe(3);
    expect(closest("lss", ["ls", "cd", "cat"])).toBe("ls");
    expect(closest("zzzzzz", ["ls", "cd"])).toBeNull();
  });
});

describe("virtual filesystem", () => {
  const bootstrap = makeBootstrap();
  const publicFs = buildFs(bootstrap, false);

  it("mirrors visible, non-empty sections in the owner's order", () => {
    // hero and arcade never become entries; empty sections (focus, skills …) are skipped.
    expect(publicFs.children.map((n) => n.name)).toEqual([
      "about",
      "philosophy",
      "experience",
      "projects",
      "contact",
      "links",
    ]);
  });

  it("omits the blog while it has no posts and hides it when disabled", () => {
    expect(publicFs.children.some((n) => n.name === "blog")).toBe(false);
    const withPost = makeBootstrap({
      posts: [{ id: 1, slug: "hello", title: "Hello", excerpt: "x", is_published: true, tags: [], reading_minutes: 1 } as never],
    });
    expect(buildFs(withPost).children.some((n) => n.name === "blog")).toBe(true);
    const disabled = makeBootstrap({
      site: { ...withPost.site, blog_enabled: false },
      posts: withPost.posts,
    });
    expect(buildFs(disabled).children.some((n) => n.name === "blog")).toBe(false);
  });

  it("names experience entries by organization, adding the role only on collisions", () => {
    const dir = lookup(publicFs, ["experience"]);
    expect(dir?.type === "dir" && dir.children.map((c) => c.name)).toEqual([
      "saarathi-finance",
      "smollan-research-intern",
      "smollan-contractor",
    ]);
  });

  it("flags unpublished items as drafts", () => {
    const secret = lookup(buildFs(bootstrap, true), ["projects", "secret-draft"]);
    expect(secret?.draft).toBe(true);
    expect(lookup(buildFs(bootstrap, true), ["projects", "inference-lab"])?.draft).toBe(false);
  });

  it("slugifies and keeps names unique inside a directory", () => {
    expect(slugify("  Hello, World! — v2  ")).toBe("hello-world-v2");
    const twice = makeBootstrap({
      achievements: [
        { id: 1, order: 0, is_published: true, title: "Award", kind: "award", highlights: [] },
        { id: 2, order: 1, is_published: true, title: "Award", kind: "award", highlights: [] },
      ] as never,
      sections: [...bootstrap.sections, { id: 99, key: "achievements", title: "Awards", subtitle: "", is_visible: true, order: 9 }],
    });
    const dir = lookup(buildFs(twice), ["achievements"]);
    expect(dir?.type === "dir" && dir.children.map((c) => c.name)).toEqual(["award", "award-2"]);
  });

  it("normalizes ~, /, ., .. and stays at the root when going above it", () => {
    expect(normalize(["projects"], "..")).toEqual([]);
    expect(normalize([], "../..")).toEqual([]);
    expect(normalize(["projects"], "~/experience/smollan")).toEqual(["experience", "smollan"]);
    expect(normalize(["projects"], "/about")).toEqual(["about"]);
    expect(normalize(["projects"], "./Inference-Lab/")).toEqual(["projects", "inference-lab"]);
    expect(formatPath([])).toBe("~");
    expect(formatPath(["projects", "x"])).toBe("~/projects/x");
  });

  it("resolves relative to the working directory", () => {
    expect(resolve(publicFs, ["projects"], "inference-lab")?.name).toBe("inference-lab");
    expect(resolve(publicFs, [], "projects/inference-lab")?.name).toBe("inference-lab");
    expect(resolve(publicFs, [], "projects/nope")).toBeNull();
    expect(resolve(publicFs, [], "about/inside-a-file")).toBeNull();
  });

  it("maps nodes to the owner resource that edits them", () => {
    const about = lookup(publicFs, ["about"])!;
    expect(resourceOf(about)).toEqual({ resource: "profile", id: null });
    const project = lookup(publicFs, ["projects", "inference-lab"])!;
    expect(resourceOf(project)).toEqual({ resource: "projects", id: 10 });
    const projects = lookup(publicFs, ["projects"])!;
    expect(resourceOf(projects)).toEqual({ resource: "projects", id: null });
    // Every resource referenced exists in the registry the editor uses.
    for (const node of walk(publicFs)) {
      const r = resourceOf(node);
      if (r) expect(() => getResource(r.resource)).not.toThrow();
    }
  });
});

describe("tab completion", () => {
  const root = buildFs(makeBootstrap(), false);
  const spec = completionSpec(root, false);

  it("completes command names, including section shortcuts", () => {
    expect(complete("he", [], root, spec).line).toBe("help ");
    expect(complete("proj", [], root, spec).line).toBe("projects ");
  });

  it("lists options and extends to the common prefix when ambiguous", () => {
    const r = complete("c", [], root, spec);
    expect(r.options).toEqual(expect.arrayContaining(["cat", "cd", "clear", "contact"]));
  });

  it("completes paths, adding a slash for directories and a space for files", () => {
    expect(complete("cat pro", [], root, spec).line).toBe("cat projects/");
    expect(complete("cat projects/inf", [], root, spec).line).toBe("cat projects/inference-lab ");
    expect(complete("cat abo", [], root, spec).line).toBe("cat about ");
  });

  it("completes relative to the working directory and only offers directories to cd", () => {
    expect(complete("cat inf", ["projects"], root, spec).line).toBe("cat inference-lab ");
    const cd = complete("cd ", [], root, spec);
    expect(cd.options).toEqual(expect.arrayContaining(["experience/", "projects/", "links/"]));
    expect(cd.options).not.toContain("about");
  });

  it("completes fixed vocabularies", () => {
    expect(complete("theme d", [], root, spec).line).toBe("theme dark ");
    expect(complete("mode te", [], root, spec).line).toBe("mode terminal ");
  });

  it("leaves unmatched input alone", () => {
    expect(complete("cat zzz", [], root, spec)).toEqual({ line: "cat zzz", options: [] });
  });

  it("offers owner commands only to the owner", () => {
    expect(spec.commands).not.toContain("publish");
    expect(completionSpec(root, true).commands).toContain("publish");
  });
});

describe("command registry", () => {
  it("has unique names and aliases", () => {
    const all = COMMANDS.flatMap((c) => [c.name, ...(c.aliases ?? [])]);
    expect(new Set(all).size).toBe(all.length);
  });

  it("marks every state-changing owner command as ownerOnly", () => {
    for (const name of ["edit", "new", "set", "publish", "hide", "restore"]) {
      expect(COMMANDS.find((c) => c.name === name)?.ownerOnly, name).toBe(true);
    }
  });
});

describe("set: value coercion", () => {
  const project = getResource("projects");
  const field = (name: string) => findField(project, name) as FieldDef;

  it("finds fields case-insensitively", () => {
    expect(findField(project, "SUMMARY")?.name).toBe("summary");
    expect(findField(project, "nope")).toBeUndefined();
  });

  it("parses booleans, lists and dates", () => {
    expect(coerceFieldValue(field("is_featured"), "yes")).toEqual({ ok: true, value: true });
    expect(coerceFieldValue(field("is_featured"), "off")).toEqual({ ok: true, value: false });
    expect(coerceFieldValue(field("is_featured"), "maybe").ok).toBe(false);
    expect(coerceFieldValue(field("tags"), "CUDA, Triton ,")).toEqual({ ok: true, value: ["CUDA", "Triton"] });
    expect(coerceFieldValue(field("start_date"), "2025-03-31")).toEqual({ ok: true, value: "2025-03-31" });
    expect(coerceFieldValue(field("start_date"), "31/03/2025").ok).toBe(false);
    expect(coerceFieldValue(field("end_date"), "")).toEqual({ ok: true, value: null });
  });

  it("validates select options and accepts labels", () => {
    expect(coerceFieldValue(field("status"), "in_progress")).toEqual({ ok: true, value: "in_progress" });
    expect(coerceFieldValue(field("status"), "Completed")).toEqual({ ok: true, value: "completed" });
    const bad = coerceFieldValue(field("status"), "done");
    expect(bad.ok === false && bad.error).toContain("completed");
  });

  it("validates numbers against min/max and colours", () => {
    const level = findField(getResource("skills"), "level") as FieldDef;
    expect(coerceFieldValue(level, "4")).toEqual({ ok: true, value: 4 });
    expect(coerceFieldValue(level, "9").ok).toBe(false);
    expect(coerceFieldValue(level, "x").ok).toBe(false);
    const accent = findField(getResource("site"), "accent_color") as FieldDef;
    expect(coerceFieldValue(accent, "#e8a33d").ok).toBe(true);
    expect(coerceFieldValue(accent, "orange").ok).toBe(false);
  });

  it("refuses empty required text and points editor-only fields to `edit`", () => {
    expect(coerceFieldValue(field("title"), "   ").ok).toBe(false);
    expect(coerceFieldValue(field("title"), " New title ")).toEqual({ ok: true, value: "New title" });
    const cover = coerceFieldValue(field("cover"), "x");
    expect(cover.ok === false && cover.error).toContain("edit");
  });
});
