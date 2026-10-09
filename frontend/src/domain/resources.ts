/**
 * Resource registry — declarative description of every owner-editable resource.
 *
 * One definition drives:
 *   - the sudo dashboard (list page, drag reorder, publish toggle, edit drawer),
 *   - inline editing on the live page (EditableRegion → EditDrawer),
 *   - version history (via `versionResource`, e.g. "projects.project").
 *
 * Adding a field to a Django serializer = adding one FieldDef here; the form,
 * validation-error display and PATCH payload follow automatically.
 */
import type { SectionKey } from "@/api/types";

export type FieldType =
  | "text"
  | "textarea"
  | "markdown"
  | "url"
  | "email"
  | "date"
  | "boolean"
  | "select"
  | "relation"
  | "number"
  | "color"
  | "stringList"
  | "tags"
  | "media"
  | "gallery"
  | "metrics";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  help?: string;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** For `relation`: admin endpoint to load options from, and the label key. */
  relation?: { endpoint: string; labelKey: string };
  /** For `media`: restrict the picker to a kind. */
  mediaKind?: "image" | "document";
  /** Takes the full form width on wide screens. */
  wide?: boolean;
  min?: number;
  max?: number;
}

export interface ResourceDef {
  key: string;
  /** Admin endpoint under /api/v1/admin/. */
  endpoint: string;
  kind: "collection" | "singleton";
  label: string;
  singular: string;
  /** "<app_label>.<model>" for /admin/versions/?resource= */
  versionResource: string;
  fields: FieldDef[];
  title: (item: Record<string, unknown>) => string;
  subtitle?: (item: Record<string, unknown>) => string;
  orderable?: boolean;
  publishable?: boolean;
  canCreate?: boolean;
  canDelete?: boolean;
  defaults?: Record<string, unknown>;
  /** Homepage section this resource feeds (used by inline editing affordances). */
  section?: SectionKey;
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

const EMPLOYMENT = [
  ["full_time", "Full-time"],
  ["part_time", "Part-time"],
  ["internship", "Internship"],
  ["contract", "Contract"],
  ["freelance", "Freelance"],
  ["research", "Research"],
].map(([value, label]) => ({ value, label }));

const PROJECT_CATEGORY = [
  ["ai_systems", "AI systems / inference"],
  ["ml", "Machine learning / CV"],
  ["llm", "LLM / RAG / agents"],
  ["systems", "Systems / C++"],
  ["backend", "Backend"],
  ["fullstack", "Full-stack"],
  ["mobile", "Mobile"],
  ["other", "Other"],
].map(([value, label]) => ({ value, label }));

/** 3D-mode exhibits a skill group can link to. Keep ids in sync with modes/three/exhibits/catalog.ts (a test checks). */
export const EXHIBIT_OPTIONS = [
  ["hardware", "Hardware: motherboard to registers"],
  ["cuda", "CUDA: GPU to a single thread"],
  ["transformer", "Transformer: stack to softmax"],
].map(([value, label]) => ({ value, label }));

const PROJECT_STATUS = [
  ["completed", "Completed"],
  ["in_progress", "In progress"],
  ["archived", "Archived"],
].map(([value, label]) => ({ value, label }));

const ACHIEVEMENT_KIND = [
  ["leadership", "Leadership"],
  ["hackathon", "Hackathon"],
  ["award", "Award"],
  ["certification", "Certification"],
  ["community", "Community"],
  ["other", "Other"],
].map(([value, label]) => ({ value, label }));

const PLATFORMS = [
  ["github", "GitHub"],
  ["linkedin", "LinkedIn"],
  ["x", "X / Twitter"],
  ["email", "Email"],
  ["website", "Website"],
  ["leetcode", "LeetCode"],
  ["kaggle", "Kaggle"],
  ["medium", "Medium"],
  ["other", "Other"],
].map(([value, label]) => ({ value, label }));

const MODES = [
  { value: "simple", label: "Simple" },
  { value: "terminal", label: "Terminal" },
  { value: "3d", label: "3D" },
  { value: "drive", label: "Drive" },
];

export const RESOURCES: Record<string, ResourceDef> = {
  profile: {
    key: "profile",
    endpoint: "profile",
    kind: "singleton",
    label: "Profile",
    singular: "profile",
    versionResource: "profiles.profile",
    section: "hero",
    title: (p) => str(p.full_name),
    fields: [
      { name: "full_name", label: "Full name", type: "text", required: true },
      { name: "headline", label: "Headline", type: "text" },
      { name: "tagline", label: "Tagline", type: "textarea", wide: true },
      {
        name: "roles",
        label: "Rotating roles",
        type: "stringList",
        help: "Shown one after another in the hero",
      },
      {
        name: "journey",
        label: "Career trace",
        type: "stringList",
        wide: true,
        help: "Stages in order, oldest first. Drawn as the hero's profiler trace; the last one is your current focus.",
      },
      { name: "bio", label: "Short bio", type: "textarea", wide: true },
      { name: "about", label: "About", type: "markdown", wide: true },
      { name: "philosophy", label: "Engineering philosophy", type: "markdown", wide: true },
      { name: "location", label: "Location", type: "text" },
      { name: "email", label: "Public email", type: "email" },
      { name: "availability", label: "Availability note", type: "text" },
      { name: "is_available", label: "Open to opportunities", type: "boolean" },
      { name: "avatar", label: "Avatar", type: "media", mediaKind: "image" },
    ],
  },
  site: {
    key: "site",
    endpoint: "site",
    kind: "singleton",
    label: "Site settings",
    singular: "settings",
    versionResource: "site_config.siteconfig",
    title: (s) => str(s.site_title),
    fields: [
      { name: "site_title", label: "Site title", type: "text", required: true, wide: true },
      { name: "meta_description", label: "Search description", type: "textarea", wide: true },
      { name: "og_image", label: "Link preview image", type: "media", mediaKind: "image" },
      {
        name: "default_mode",
        label: "Default mode for new visitors",
        type: "select",
        options: MODES,
      },
      {
        name: "default_theme",
        label: "Default theme",
        type: "select",
        options: [
          { value: "system", label: "Follow visitor's system" },
          { value: "dark", label: "Dark" },
          { value: "light", label: "Light" },
        ],
      },
      { name: "accent_color", label: "Accent colour", type: "color" },
      { name: "terminal_hostname", label: "Terminal prompt", type: "text" },
      { name: "sound_default_on", label: "Sound on by default", type: "boolean" },
      { name: "blog_enabled", label: "Show writing", type: "boolean" },
      { name: "games_enabled", label: "Show arcade", type: "boolean" },
      { name: "contact_enabled", label: "Accept messages", type: "boolean" },
      { name: "analytics_enabled", label: "Collect visit stats", type: "boolean" },
      { name: "footer_note", label: "Footer note", type: "text", wide: true },
    ],
  },
  sections: {
    key: "sections",
    endpoint: "sections",
    kind: "collection",
    label: "Sections",
    singular: "section",
    versionResource: "site_config.section",
    orderable: true,
    canCreate: false,
    canDelete: false,
    title: (s) => str(s.title),
    subtitle: (s) => str(s.key),
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "subtitle", label: "Subtitle", type: "text", wide: true },
      { name: "is_visible", label: "Visible", type: "boolean" },
    ],
  },
  "social-links": {
    key: "social-links",
    endpoint: "social-links",
    kind: "collection",
    label: "Links",
    singular: "link",
    versionResource: "profiles.sociallink",
    orderable: true,
    publishable: true,
    section: "contact",
    title: (s) => str(s.label),
    subtitle: (s) => str(s.url),
    defaults: { platform: "github" },
    fields: [
      { name: "platform", label: "Platform", type: "select", options: PLATFORMS },
      { name: "label", label: "Label", type: "text", required: true },
      { name: "url", label: "URL", type: "text", required: true, placeholder: "https://…" },
    ],
  },
  "focus-areas": {
    key: "focus-areas",
    endpoint: "focus-areas",
    kind: "collection",
    label: "Focus areas",
    singular: "focus area",
    versionResource: "profiles.focusarea",
    orderable: true,
    publishable: true,
    section: "focus",
    title: (f) => str(f.title),
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", wide: true },
      { name: "items", label: "Topics", type: "stringList", wide: true },
      { name: "icon", label: "Icon key", type: "text", help: "cpu, gpu, layers, terminal …" },
    ],
  },
  experience: {
    key: "experience",
    endpoint: "experience",
    kind: "collection",
    label: "Experience",
    singular: "role",
    versionResource: "experience.experience",
    orderable: true,
    publishable: true,
    section: "experience",
    title: (e) => str(e.role),
    subtitle: (e) => str(e.organization),
    defaults: { employment_type: "full_time" },
    fields: [
      { name: "role", label: "Role", type: "text", required: true },
      { name: "organization", label: "Organization", type: "text", required: true },
      { name: "organization_url", label: "Organization website", type: "url" },
      { name: "employment_type", label: "Type", type: "select", options: EMPLOYMENT },
      { name: "location", label: "Location", type: "text" },
      { name: "start_date", label: "Start", type: "date" },
      { name: "end_date", label: "End", type: "date", help: "Leave empty if current" },
      { name: "summary", label: "Summary", type: "textarea", wide: true },
      { name: "highlights", label: "Highlights", type: "stringList", wide: true },
      { name: "tags", label: "Tech", type: "tags", wide: true },
      { name: "logo", label: "Logo", type: "media", mediaKind: "image" },
    ],
  },
  education: {
    key: "education",
    endpoint: "education",
    kind: "collection",
    label: "Education",
    singular: "education entry",
    versionResource: "experience.education",
    orderable: true,
    publishable: true,
    section: "education",
    title: (e) => str(e.degree),
    subtitle: (e) => str(e.institution),
    fields: [
      { name: "institution", label: "Institution", type: "text", required: true, wide: true },
      { name: "degree", label: "Degree", type: "text", required: true },
      { name: "field_of_study", label: "Field of study", type: "text" },
      { name: "location", label: "Location", type: "text" },
      { name: "grade", label: "Grade", type: "text" },
      { name: "start_date", label: "Start", type: "date" },
      { name: "end_date", label: "End", type: "date" },
      { name: "description", label: "Description", type: "textarea", wide: true },
      { name: "highlights", label: "Highlights", type: "stringList", wide: true },
    ],
  },
  achievements: {
    key: "achievements",
    endpoint: "achievements",
    kind: "collection",
    label: "Achievements",
    singular: "achievement",
    versionResource: "experience.achievement",
    orderable: true,
    publishable: true,
    section: "achievements",
    title: (a) => str(a.title),
    subtitle: (a) => str(a.kind),
    defaults: { kind: "leadership" },
    fields: [
      { name: "title", label: "Title", type: "text", required: true, wide: true },
      { name: "kind", label: "Kind", type: "select", options: ACHIEVEMENT_KIND },
      { name: "organization", label: "Organization", type: "text" },
      { name: "date", label: "Date", type: "date" },
      { name: "url", label: "Link", type: "url" },
      { name: "description", label: "Description", type: "textarea", wide: true },
      { name: "highlights", label: "Highlights", type: "stringList", wide: true },
    ],
  },
  projects: {
    key: "projects",
    endpoint: "projects",
    kind: "collection",
    label: "Projects",
    singular: "project",
    versionResource: "projects.project",
    orderable: true,
    publishable: true,
    section: "projects",
    title: (p) => str(p.title),
    subtitle: (p) => str(p.summary),
    defaults: { category: "other", status: "completed" },
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "slug", label: "URL slug", type: "text", help: "Generated from the title if empty" },
      { name: "summary", label: "Summary", type: "textarea", wide: true },
      { name: "category", label: "Category", type: "select", options: PROJECT_CATEGORY },
      { name: "status", label: "Status", type: "select", options: PROJECT_STATUS },
      { name: "role", label: "My role", type: "text" },
      { name: "is_featured", label: "Featured", type: "boolean" },
      { name: "start_date", label: "Start", type: "date" },
      { name: "end_date", label: "End", type: "date" },
      { name: "repo_url", label: "Repository", type: "url" },
      { name: "demo_url", label: "Live demo", type: "url" },
      { name: "highlights", label: "Highlights", type: "stringList", wide: true },
      {
        name: "metrics",
        label: "Measurements",
        type: "metrics",
        wide: true,
        help: "Numbers you measured, e.g. p95 latency → −38%",
      },
      { name: "tags", label: "Tech", type: "tags", wide: true },
      { name: "description", label: "Case study", type: "markdown", wide: true },
      { name: "cover", label: "Cover image", type: "media", mediaKind: "image" },
      { name: "gallery", label: "Gallery", type: "gallery", wide: true },
    ],
  },
  "skill-categories": {
    key: "skill-categories",
    endpoint: "skill-categories",
    kind: "collection",
    label: "Skill groups",
    singular: "skill group",
    versionResource: "skills.skillcategory",
    orderable: true,
    publishable: true,
    section: "skills",
    title: (c) => str(c.name),
    subtitle: (c) => str(c.description),
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "description", label: "Description", type: "text", wide: true },
      { name: "icon", label: "Icon key", type: "text" },
      {
        name: "exhibit",
        label: "3D exhibit",
        type: "select",
        options: [{ value: "", label: "None" }, ...EXHIBIT_OPTIONS],
      },
    ],
  },
  skills: {
    key: "skills",
    endpoint: "skills",
    kind: "collection",
    label: "Skills",
    singular: "skill",
    versionResource: "skills.skill",
    orderable: true,
    publishable: true,
    section: "skills",
    title: (s) => str(s.name),
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      {
        name: "category",
        label: "Group",
        type: "relation",
        required: true,
        relation: { endpoint: "skill-categories", labelKey: "name" },
      },
      { name: "level", label: "Level (1-5)", type: "number", min: 1, max: 5 },
      { name: "is_highlighted", label: "Highlight", type: "boolean" },
    ],
  },
  posts: {
    key: "posts",
    endpoint: "posts",
    kind: "collection",
    label: "Writing",
    singular: "post",
    versionResource: "blog.post",
    publishable: true,
    section: "blog",
    title: (p) => str(p.title),
    subtitle: (p) => (p.is_published ? "Published" : "Draft"),
    defaults: { is_published: false },
    fields: [
      { name: "title", label: "Title", type: "text", required: true, wide: true },
      { name: "slug", label: "URL slug", type: "text" },
      { name: "is_featured", label: "Featured", type: "boolean" },
      { name: "excerpt", label: "Excerpt", type: "textarea", wide: true },
      { name: "tags", label: "Tags", type: "tags", wide: true },
      { name: "body", label: "Body", type: "markdown", wide: true },
      { name: "cover", label: "Cover image", type: "media", mediaKind: "image" },
    ],
  },
  resumes: {
    key: "resumes",
    endpoint: "resumes",
    kind: "collection",
    label: "Resumes",
    singular: "resume",
    versionResource: "profiles.resumeversion",
    title: (r) => str(r.label),
    subtitle: (r) => (r.is_active ? "Offered for download" : "Inactive"),
    fields: [
      { name: "label", label: "Label", type: "text", required: true, wide: true },
      { name: "asset", label: "PDF", type: "media", mediaKind: "document", required: true },
      { name: "is_active", label: "Offer this one for download", type: "boolean" },
      { name: "notes", label: "Notes", type: "textarea", wide: true },
    ],
  },
};

/** Resources that feed each homepage section — powers "edit this section" in inline mode. */
export const SECTION_RESOURCES: Partial<Record<SectionKey, string[]>> = {
  hero: ["profile", "social-links"],
  about: ["profile"],
  focus: ["focus-areas"],
  experience: ["experience"],
  projects: ["projects"],
  skills: ["skill-categories", "skills"],
  education: ["education"],
  achievements: ["achievements"],
  blog: ["posts"],
  contact: ["social-links", "profile"],
};

export function getResource(key: string): ResourceDef {
  const def = RESOURCES[key];
  if (!def) throw new Error(`Unknown resource "${key}"`);
  return def;
}
