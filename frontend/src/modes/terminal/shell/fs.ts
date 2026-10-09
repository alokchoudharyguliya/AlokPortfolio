/**
 * The Terminal's virtual filesystem.
 *
 * Content is presented as a tree so ordinary shell verbs work on it:
 *
 *   ~
 *   ├── about, philosophy            (files from the profile)
 *   ├── focus/ experience/ projects/ skills/ education/ achievements/ blog/
 *   ├── contact                      (file)
 *   ├── links/                       (one file per social link)
 *   └── resume                       (file, when a resume is uploaded)
 *
 * The tree is rebuilt from the `SectionModel` list on every bootstrap change,
 * so it honours the owner's section order and visibility exactly like the
 * other modes (domain/sections.ts). Nothing here touches React or the network.
 */
import type {
  Achievement,
  Bootstrap,
  Education,
  Experience,
  FocusArea,
  PostSummary,
  Profile,
  Project,
  SkillCategory,
  SocialLink,
} from "@/api/types";
import { buildSections } from "@/domain/sections";

export type Path = string[];

interface Base {
  name: string;
  path: Path;
  /** One line shown by `ls -l` and in section overviews. */
  summary: string;
  /** True for unpublished items (only present while the owner is editing). */
  draft: boolean;
}

export type FileBody =
  | { kind: "about"; profile: Profile }
  | { kind: "philosophy"; profile: Profile }
  | { kind: "contact"; profile: Profile; socials: SocialLink[] }
  | { kind: "resume"; resume: { label: string; url: string } }
  | { kind: "link"; item: SocialLink }
  | { kind: "focus"; item: FocusArea }
  | { kind: "experience"; item: Experience }
  | { kind: "education"; item: Education }
  | { kind: "achievement"; item: Achievement }
  | { kind: "project"; item: Project }
  | { kind: "skills"; item: SkillCategory }
  | { kind: "post"; item: PostSummary };

export type VFile = Base & { type: "file" } & FileBody;
export interface VDir extends Base {
  type: "dir";
  /** Section title chosen by the owner (e.g. "Selected work"). */
  title: string;
  children: VNode[];
}
export type VNode = VFile | VDir;

/** Directory name → owner resource key (for `new`). */
export const DIR_RESOURCE: Record<string, string> = {
  focus: "focus-areas",
  experience: "experience",
  projects: "projects",
  skills: "skill-categories",
  education: "education",
  achievements: "achievements",
  blog: "posts",
  links: "social-links",
};

export function slugify(text: string, max = 40): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

/** Ensures names are unique inside one directory by appending -2, -3 … */
function unique(base: string, used: Set<string>, fallback: string): string {
  const root = base || fallback;
  let name = root;
  for (let n = 2; used.has(name); n++) name = `${root}-${n}`;
  used.add(name);
  return name;
}

const oneLine = (text: string, max = 90) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
};

export function buildFs(b: Bootstrap, editing = false): VDir {
  const root: VDir = { type: "dir", name: "~", path: [], title: "Home", summary: "", draft: false, children: [] };

  const addFile = (parent: VDir, name: string, body: FileBody, summary: string, draft = false) => {
    parent.children.push({ type: "file", name, path: [...parent.path, name], summary, draft, ...body } as VFile);
  };
  const addDir = (name: string, title: string, summary = ""): VDir => {
    const dir: VDir = { type: "dir", name, path: [name], title, summary, draft: false, children: [] };
    root.children.push(dir);
    return dir;
  };
  /** Fill a directory from a list, naming each entry with `nameOf`. */
  const fill = <T extends { is_published?: boolean }>(
    dir: VDir,
    items: T[],
    nameOf: (item: T, all: T[]) => string,
    body: (item: T) => FileBody,
    summaryOf: (item: T) => string,
  ) => {
    const used = new Set<string>();
    for (const item of items) {
      const name = unique(nameOf(item, items), used, `item-${used.size + 1}`);
      addFile(dir, name, body(item), oneLine(summaryOf(item)), item.is_published === false);
    }
  };

  for (const s of buildSections(b)) {
    if (s.isEmpty && !editing) continue;
    switch (s.key) {
      case "about": {
        const { profile } = s.data;
        addFile(root, "about", { kind: "about", profile }, oneLine(profile.bio || profile.about));
        if (profile.philosophy) {
          addFile(root, "philosophy", { kind: "philosophy", profile }, "How I approach performance and engineering");
        }
        break;
      }
      case "focus":
        fill(
          addDir("focus", s.meta.title, s.meta.subtitle),
          s.data.areas,
          (a) => slugify(a.title),
          (item) => ({ kind: "focus", item }),
          (a) => a.description,
        );
        break;
      case "experience":
        fill(
          addDir("experience", s.meta.title, s.meta.subtitle),
          s.data.items,
          (e, all) =>
            slugify(all.filter((o) => o.organization === e.organization).length > 1 ? `${e.organization} ${e.role}` : e.organization),
          (item) => ({ kind: "experience", item }),
          (e) => `${e.role} at ${e.organization}`,
        );
        break;
      case "projects":
        fill(
          addDir("projects", s.meta.title, s.meta.subtitle),
          s.data.items,
          (p) => p.slug || slugify(p.title),
          (item) => ({ kind: "project", item }),
          (p) => p.summary || p.title,
        );
        break;
      case "skills":
        fill(
          addDir("skills", s.meta.title, s.meta.subtitle),
          s.data.categories,
          (c) => slugify(c.name),
          (item) => ({ kind: "skills", item }),
          (c) => c.description || (c.skills ?? []).map((k) => k.name).join(", "),
        );
        break;
      case "education":
        fill(
          addDir("education", s.meta.title, s.meta.subtitle),
          s.data.items,
          (e, all) => slugify(all.filter((o) => o.degree === e.degree).length > 1 ? `${e.degree} ${e.institution}` : e.degree),
          (item) => ({ kind: "education", item }),
          (e) => `${e.degree}, ${e.institution}`,
        );
        break;
      case "achievements":
        fill(
          addDir("achievements", s.meta.title, s.meta.subtitle),
          s.data.items,
          (a) => slugify(a.title),
          (item) => ({ kind: "achievement", item }),
          (a) => a.description || a.title,
        );
        break;
      case "blog":
        if (b.site.blog_enabled || editing) {
          fill(
            addDir("blog", s.meta.title, s.meta.subtitle),
            s.data.posts,
            (p) => p.slug || slugify(p.title),
            (item) => ({ kind: "post", item }),
            (p) => p.excerpt || p.title,
          );
        }
        break;
      case "contact": {
        const { profile, socials } = s.data;
        addFile(root, "contact", { kind: "contact", profile, socials }, "Email, links and a message form");
        if (socials.length) {
          fill(
            addDir("links", "Links"),
            socials,
            (l) => slugify(l.platform === "other" ? l.label : l.platform),
            (item) => ({ kind: "link", item }),
            (l) => l.url,
          );
        }
        break;
      }
      default:
        break;
    }
  }

  if (b.resume) {
    addFile(root, "resume", { kind: "resume", resume: b.resume }, b.resume.label || "Download my resume");
  }
  return root;
}

/**
 * Turn user input into an absolute path, resolving `~`, `/`, `.`, `..`.
 * Like a real shell, `..` at the root stays at the root.
 */
export function normalize(cwd: Path, input: string): Path {
  const absolute = input === "~" || input.startsWith("~/") || input.startsWith("/");
  const out = absolute ? [] : [...cwd];
  const rest = input.replace(/^~\/?/, "").replace(/^\/+/, "");
  for (const part of rest.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part.toLowerCase());
  }
  return out;
}

export function lookup(root: VDir, path: Path): VNode | null {
  let node: VNode = root;
  for (const part of path) {
    if (node.type !== "dir") return null;
    const next: VNode | undefined = node.children.find((c) => c.name === part);
    if (!next) return null;
    node = next;
  }
  return node;
}

export function resolve(root: VDir, cwd: Path, input: string): VNode | null {
  return lookup(root, normalize(cwd, input));
}

export function formatPath(path: Path): string {
  return path.length ? `~/${path.join("/")}` : "~";
}

/** Entry name for display: directories get a trailing slash. */
export const displayName = (n: VNode) => (n.type === "dir" ? `${n.name}/` : n.name);

/** Every path in the tree, depth-first (used by `tree` and tab-completion tests). */
export function walk(node: VNode): VNode[] {
  return node.type === "dir" ? [node, ...node.children.flatMap(walk)] : [node];
}

/**
 * Which owner resource a node belongs to, for edit/set/publish/hide/history.
 * Profile-backed files (about, philosophy, contact) map to the profile
 * singleton; the resume has no inline editor, so it maps to nothing.
 */
export function resourceOf(node: VNode): { resource: string; id: number | null } | null {
  if (node.type === "dir") {
    const resource = DIR_RESOURCE[node.name];
    return node.path.length === 1 && resource ? { resource, id: null } : null;
  }
  switch (node.kind) {
    case "about":
    case "philosophy":
    case "contact":
      return { resource: "profile", id: null };
    case "resume":
      return null;
    case "link":
      return { resource: "social-links", id: node.item.id };
    case "focus":
      return { resource: "focus-areas", id: node.item.id };
    case "experience":
      return { resource: "experience", id: node.item.id };
    case "education":
      return { resource: "education", id: node.item.id };
    case "achievement":
      return { resource: "achievements", id: node.item.id };
    case "project":
      return { resource: "projects", id: node.item.id };
    case "skills":
      return { resource: "skill-categories", id: node.item.id };
    case "post":
      return { resource: "posts", id: node.item.id };
  }
}
