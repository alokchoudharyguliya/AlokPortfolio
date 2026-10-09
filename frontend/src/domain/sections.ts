/**
 * Section view-models — the contract between data and presentation.
 *
 * `buildSections(bootstrap)` turns the API aggregate into an ordered list of
 * `SectionModel`s. Every mode (Simple, Terminal, 3D) renders the SAME list:
 * Simple maps each key to a React section, Terminal maps each key to a
 * command's output, 3D maps each key to a scene. Order and visibility come from
 * the owner's settings in sudo (site_config.Section).
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
  PublicGame,
  Section,
  SectionKey,
  SiteConfig,
  SkillCategory,
  SocialLink,
} from "@/api/types";

export interface SectionDataMap {
  hero: {
    profile: Profile;
    socials: SocialLink[];
    resume: Bootstrap["resume"];
    site: SiteConfig;
  };
  about: { profile: Profile };
  focus: { areas: FocusArea[] };
  experience: { items: Experience[] };
  projects: { items: Project[] };
  skills: { categories: SkillCategory[] };
  education: { items: Education[] };
  achievements: { items: Achievement[] };
  blog: { posts: PostSummary[] };
  arcade: { games: PublicGame[] };
  contact: { profile: Profile; socials: SocialLink[]; enabled: boolean };
}

export interface SectionModel<K extends SectionKey = SectionKey> {
  key: K;
  meta: Section;
  data: SectionDataMap[K];
  /** Nothing to show publicly; modes skip empty sections (the owner still sees them in edit mode). */
  isEmpty: boolean;
}

export type AnySectionModel = { [K in SectionKey]: SectionModel<K> }[SectionKey];

function dataFor(key: SectionKey, b: Bootstrap): SectionDataMap[SectionKey] {
  switch (key) {
    case "hero":
      return { profile: b.profile, socials: b.social_links, resume: b.resume, site: b.site };
    case "about":
      return { profile: b.profile };
    case "focus":
      return { areas: b.focus_areas };
    case "experience":
      return { items: b.experience };
    case "projects":
      return { items: b.projects };
    case "skills":
      return { categories: b.skills };
    case "education":
      return { items: b.education };
    case "achievements":
      return { items: b.achievements };
    case "blog":
      return { posts: b.posts };
    case "arcade":
      return { games: b.games };
    case "contact":
      return { profile: b.profile, socials: b.social_links, enabled: b.site.contact_enabled };
  }
}

function isEmpty(key: SectionKey, data: SectionDataMap[SectionKey]): boolean {
  const d = data as Record<string, unknown>;
  switch (key) {
    case "hero":
      return false;
    case "about": {
      const p = (d as SectionDataMap["about"]).profile;
      return !p.about && !p.philosophy;
    }
    case "contact":
      return !(d as SectionDataMap["contact"]).enabled;
    default: {
      const list = Object.values(d).find(Array.isArray) as unknown[] | undefined;
      return !list || list.length === 0;
    }
  }
}

export function buildSections(b: Bootstrap): AnySectionModel[] {
  return [...b.sections]
    .sort((a, z) => a.order - z.order)
    .map((meta) => {
      const data = dataFor(meta.key, b);
      return { key: meta.key, meta, data, isEmpty: isEmpty(meta.key, data) } as AnySectionModel;
    });
}
