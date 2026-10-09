/**
 * The small telemetry chip in the corner: one honest number about whatever
 * the camera is currently looking at, taken straight from the content.
 */
import type { Bootstrap } from "@/api/types";

export interface Readout {
  label: string;
  value: number;
}

export function readoutFor(key: string, b: Bootstrap): Readout | null {
  switch (key) {
    case "hero":
      return { label: "stages in the career trace", value: b.profile.journey.length };
    case "focus":
      return { label: "focus areas", value: b.focus_areas.length };
    case "experience":
      return { label: "roles on the pipeline", value: b.experience.length };
    case "projects":
      return { label: "projects, one die tile each", value: b.projects.length };
    case "skills":
      return { label: "skills across memory tiers", value: b.skills.reduce((n, c) => n + (c.skills?.length ?? 0), 0) };
    case "education":
      return { label: "degrees", value: b.education.length };
    case "achievements":
      return { label: "achievements", value: b.achievements.length };
    case "blog":
      return { label: "posts", value: b.posts.length };
    case "contact":
      return { label: "ways to reach me", value: b.social_links.length + (b.profile.email ? 1 : 0) };
    default:
      return null;
  }
}
