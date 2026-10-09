import type { Bootstrap, Section } from "@/api/types";

import { dateRange, fileSize, humanize, monthYear } from "./format";
import { RESOURCES, SECTION_RESOURCES } from "./resources";
import { buildSections } from "./sections";

describe("format", () => {
  it("formats month/year in UTC without off-by-one days", () => {
    expect(monthYear("2024-04-01")).toBe("Apr 2024");
    expect(monthYear(null)).toBe("");
  });

  it("builds date ranges", () => {
    expect(dateRange("2024-01-01", "2024-06-30")).toBe("Jan 2024 – Jun 2024");
    expect(dateRange("2024-01-01", null)).toBe("Jan 2024 – Present");
    expect(dateRange("2024-01-01", null, false)).toBe("Jan 2024");
    expect(dateRange("2024-03-01", "2024-03-20")).toBe("Mar 2024");
    expect(dateRange(null, null)).toBe("");
  });

  it("humanizes enum values and sizes", () => {
    expect(humanize("in_progress")).toBe("In progress");
    expect(fileSize(512)).toBe("512 B");
    expect(fileSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

function section(key: Section["key"], order: number, extra: Partial<Section> = {}): Section {
  return { id: order, key, title: key, subtitle: "", is_visible: true, order, ...extra };
}

function bootstrap(overrides: Partial<Bootstrap> = {}): Bootstrap {
  return {
    site: { contact_enabled: true } as Bootstrap["site"],
    sections: [section("projects", 2), section("hero", 0), section("about", 1), section("contact", 3)],
    profile: { about: "", philosophy: "" } as Bootstrap["profile"],
    social_links: [],
    focus_areas: [],
    resume: null,
    experience: [],
    education: [],
    achievements: [],
    projects: [],
    skills: [],
    posts: [],
    games: [],
    drafts: false,
    ...overrides,
  };
}

describe("buildSections", () => {
  it("orders sections by the owner's order", () => {
    expect(buildSections(bootstrap()).map((s) => s.key)).toEqual(["hero", "about", "projects", "contact"]);
  });

  it("marks sections without content as empty (hero never is)", () => {
    const byKey = Object.fromEntries(buildSections(bootstrap()).map((s) => [s.key, s.isEmpty]));
    expect(byKey).toEqual({ hero: false, about: true, projects: true, contact: false });
  });

  it("contact is empty when the owner disables messages", () => {
    const b = bootstrap({ site: { contact_enabled: false } as Bootstrap["site"] });
    expect(buildSections(b).find((s) => s.key === "contact")?.isEmpty).toBe(true);
  });

  it("projects carry their items", () => {
    const b = bootstrap({ projects: [{ id: 1, title: "X" } as Bootstrap["projects"][number]] });
    const projects = buildSections(b).find((s) => s.key === "projects");
    expect(projects?.isEmpty).toBe(false);
    expect(projects?.key === "projects" && projects.data.items).toHaveLength(1);
  });
});

describe("resource registry", () => {
  it("every section resource exists and has a version identifier", () => {
    for (const keys of Object.values(SECTION_RESOURCES)) {
      for (const key of keys ?? []) {
        expect(RESOURCES[key], key).toBeDefined();
        expect(RESOURCES[key].versionResource).toMatch(/^[a-z_]+\.[a-z]+$/);
      }
    }
  });

  it("field names are unique per resource", () => {
    for (const def of Object.values(RESOURCES)) {
      const names = def.fields.map((f) => f.name);
      expect(new Set(names).size, def.key).toBe(names.length);
    }
  });
});
