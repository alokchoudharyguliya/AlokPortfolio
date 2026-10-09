/** Shared test fixture: a small but realistic Bootstrap payload for Terminal tests. */
import type { Bootstrap, Project, Section } from "@/api/types";

const section = (key: Section["key"], order: number, title: string = key): Section => ({
  id: order + 1,
  key,
  title,
  subtitle: "",
  is_visible: true,
  order,
});

const project = (p: Partial<Project> & Pick<Project, "id" | "title" | "slug">): Project => ({
  order: 0,
  is_published: true,
  summary: "",
  description: "",
  role: "",
  category: "other",
  status: "completed",
  start_date: null,
  end_date: null,
  repo_url: "",
  demo_url: "",
  cover: null,
  gallery: [],
  highlights: [],
  metrics: [],
  tags: [],
  is_featured: false,
  updated_at: "2026-01-01T00:00:00Z",
  ...p,
});

export function makeBootstrap(overrides: Partial<Bootstrap> = {}): Bootstrap {
  return {
    site: {
      site_title: "Alok Choudhary",
      terminal_hostname: "guest@alok",
      blog_enabled: true,
      contact_enabled: true,
    } as Bootstrap["site"],
    sections: [
      section("hero", 0),
      section("about", 1, "About"),
      section("experience", 2, "Experience"),
      section("projects", 3, "Projects"),
      section("blog", 4, "Writing"),
      section("contact", 5, "Contact"),
      section("arcade", 6),
    ],
    profile: {
      full_name: "Alok Choudhary",
      headline: "AI Systems Engineer",
      tagline: "From application code down to the GPU.",
      bio: "CSE graduate.",
      about: "I like what happens beneath an abstraction.",
      philosophy: "Measure first.",
      email: "alok@example.com",
      location: "India",
      availability: "Open to roles",
      is_available: true,
    } as Bootstrap["profile"],
    social_links: [
      { id: 1, order: 0, is_published: true, platform: "linkedin", label: "LinkedIn", url: "https://linkedin.com/in/alok" },
    ],
    focus_areas: [],
    resume: null,
    experience: [
      { id: 1, order: 0, is_published: true, role: "SDE Intern", organization: "Saarathi Finance", employment_type: "internship", highlights: ["Built REST APIs"], tags: ["Django"], summary: "Backend work" },
      { id: 2, order: 1, is_published: true, role: "Research Intern", organization: "Smollan", employment_type: "research", highlights: [], tags: [], summary: "" },
      { id: 3, order: 2, is_published: true, role: "Contractor", organization: "Smollan", employment_type: "contract", highlights: [], tags: [], summary: "" },
    ] as Bootstrap["experience"],
    education: [],
    achievements: [],
    projects: [
      project({ id: 10, order: 0, title: "Inference Lab", slug: "inference-lab", summary: "Optimising model artifacts", category: "ai_systems", status: "in_progress", tags: ["CUDA"], repo_url: "https://github.com/x/lab" }),
      project({ id: 11, order: 1, is_published: false, title: "Secret Draft", slug: "secret-draft", summary: "Not public" }),
    ],
    skills: [],
    posts: [],
    games: [],
    drafts: false,
    ...overrides,
  };
}
