/**
 * TypeScript mirrors of the Django REST serializers.
 *
 * Source of truth: backend/apps/<app>/serializers.py (and /api/docs/ Swagger).
 * Keep field names identical so the generic editor can PATCH objects back as-is.
 */

export type ModeId = "simple" | "terminal" | "3d" | "drive";
export type ThemePreference = "system" | "dark" | "light";

/** Compact media reference returned by MediaRefField. Write back the `id`. */
export interface MediaRef {
  id: number;
  url: string;
  alt: string;
  kind: MediaKind;
  width: number | null;
  height: number | null;
}

export type MediaKind = "image" | "document" | "audio" | "video" | "other";

export interface Orderable {
  id: number;
  order: number;
  is_published: boolean;
}

export interface SiteConfig {
  site_title: string;
  meta_description: string;
  og_image: MediaRef | null;
  default_mode: ModeId;
  default_theme: ThemePreference;
  accent_color: string;
  terminal_hostname: string;
  sound_default_on: boolean;
  blog_enabled: boolean;
  games_enabled: boolean;
  contact_enabled: boolean;
  analytics_enabled: boolean;
  footer_note: string;
  updated_at: string;
}

export type SectionKey =
  | "hero"
  | "about"
  | "focus"
  | "experience"
  | "projects"
  | "skills"
  | "education"
  | "achievements"
  | "blog"
  | "arcade"
  | "contact";

export interface Section {
  id: number;
  key: SectionKey;
  title: string;
  subtitle: string;
  is_visible: boolean;
  order: number;
}

export interface Profile {
  full_name: string;
  headline: string;
  tagline: string;
  roles: string[];
  /** Ordered career stages; rendered as the hero trace. */
  journey: string[];
  bio: string;
  about: string;
  philosophy: string;
  location: string;
  email: string;
  availability: string;
  is_available: boolean;
  avatar: MediaRef | null;
  updated_at: string;
}

export type SocialPlatform =
  | "github"
  | "linkedin"
  | "x"
  | "email"
  | "website"
  | "leetcode"
  | "kaggle"
  | "medium"
  | "other";

export interface SocialLink extends Orderable {
  platform: SocialPlatform;
  label: string;
  url: string;
}

export interface FocusArea extends Orderable {
  title: string;
  description: string;
  icon: string;
  items: string[];
}

export interface Experience extends Orderable {
  role: string;
  organization: string;
  organization_url: string;
  logo: MediaRef | null;
  employment_type: string;
  location: string;
  start_date: string | null;
  end_date: string | null;
  summary: string;
  highlights: string[];
  tags: string[];
}

export interface Education extends Orderable {
  institution: string;
  degree: string;
  field_of_study: string;
  location: string;
  start_date: string | null;
  end_date: string | null;
  grade: string;
  description: string;
  highlights: string[];
}

export type AchievementKind =
  | "leadership"
  | "hackathon"
  | "award"
  | "certification"
  | "community"
  | "other";

export interface Achievement extends Orderable {
  title: string;
  kind: AchievementKind;
  organization: string;
  date: string | null;
  description: string;
  highlights: string[];
  url: string;
}

export interface Metric {
  label: string;
  value: string;
}

export interface Project extends Orderable {
  title: string;
  slug: string;
  summary: string;
  description: string;
  role: string;
  category: string;
  status: "completed" | "in_progress" | "archived";
  start_date: string | null;
  end_date: string | null;
  repo_url: string;
  demo_url: string;
  cover: MediaRef | null;
  gallery: MediaRef[];
  highlights: string[];
  metrics: Metric[];
  tags: string[];
  is_featured: boolean;
  updated_at: string;
}

export interface Skill extends Orderable {
  category: number;
  name: string;
  level: number | null;
  is_highlighted: boolean;
}

export interface SkillCategory extends Orderable {
  name: string;
  description: string;
  icon: string;
  /** Id of the 3D-mode exhibit this group links to ("" = none); see modes/three/exhibits/catalog.ts. */
  exhibit?: string;
  skills?: Skill[];
}

export interface PostSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover: MediaRef | null;
  tags: string[];
  is_featured: boolean;
  is_published: boolean;
  published_at: string | null;
  reading_minutes: number;
  updated_at: string;
}

export interface Post extends PostSummary {
  body: string;
}

export interface PublicGame {
  slug: string;
  name: string;
  description: string;
}

export interface Bootstrap {
  site: SiteConfig;
  sections: Section[];
  profile: Profile;
  social_links: SocialLink[];
  focus_areas: FocusArea[];
  resume: { label: string; url: string } | null;
  experience: Experience[];
  education: Education[];
  achievements: Achievement[];
  projects: Project[];
  skills: SkillCategory[];
  posts: PostSummary[];
  games: PublicGame[];
  /** True when the payload includes unpublished rows (owner preview). */
  drafts: boolean;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Owner {
  id: number;
  username: string;
  email: string;
  has_totp: boolean;
  last_login: string | null;
}

export interface Me {
  authenticated: boolean;
  user: Owner | null;
}

export type LoginResponse =
  | { otp_required: true; challenge: string }
  | { otp_required: false; user: Owner };

export interface MediaAsset {
  id: number;
  url: string;
  original_name: string;
  kind: MediaKind;
  title: string;
  alt_text: string;
  mime_type: string;
  size: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface Message {
  id: number;
  name: string;
  email: string;
  subject: string;
  body: string;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  source_mode: string;
  created_at: string;
}

export interface VersionSummary {
  id: number;
  resource: string;
  object_id: string;
  object_repr: string;
  action: "create" | "update" | "delete" | "restore";
  user: string | null;
  created_at: string;
}

export interface VersionDetail extends VersionSummary {
  snapshot: Record<string, unknown>;
  changes: { field: string; before: unknown; after: unknown }[];
}

export interface CountRow {
  key: string;
  count: number;
}

export interface AnalyticsSummary {
  days: number;
  totals: { pageviews: number; visitors: number; events: number };
  daily: { date: string; views: number; visitors: number }[];
  by_mode: CountRow[];
  by_theme: CountRow[];
  by_device: CountRow[];
  top_paths: CountRow[];
  top_referrers: CountRow[];
  events_by_kind: CountRow[];
  games: CountRow[];
}

export interface Overview {
  projects: number;
  projects_published: number;
  posts: number;
  posts_draft: number;
  messages_unread: number;
  views_7d: number;
  visitors_7d: number;
}

export interface ResumeVersion {
  id: number;
  label: string;
  asset: MediaRef;
  notes: string;
  is_active: boolean;
  created_at: string;
}

export interface Game {
  id: number;
  slug: string;
  name: string;
  description: string;
  is_enabled: boolean;
  max_score_rate: number;
  order: number;
}

export interface ScoreRow {
  id: number;
  game: string;
  nickname: string;
  score: number;
  duration_ms: number;
  is_hidden: boolean;
  created_at: string;
}

/** Error envelope produced by apps.core.exceptions.api_exception_handler. */
export interface ApiErrorBody {
  error: {
    status: number;
    code: string;
    message: string;
    fields: Record<string, string[]>;
  };
}
