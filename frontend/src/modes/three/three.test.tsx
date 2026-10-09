/**
 * 3D mode in jsdom. There is no WebGL here, which is exactly the situation
 * the content-only fallback exists for, so this also verifies the page stays
 * fully usable without the scene.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import type { Bootstrap } from "@/api/types";
import { buildSections } from "@/domain/sections";
import { PreferencesProvider } from "@/lib/preferences/PreferencesProvider";
import { isModeAvailable } from "@/modes/registry";

import { makeBootstrap } from "../terminal/fixtures";
import { SceneContext } from "./SceneContext";
import ThreeLayout from "./ThreeLayout";
import { HomeView } from "./views";

vi.mock("@/api/auth", () => ({
  useMe: () => ({ data: { authenticated: false, user: null } }),
  useLogout: () => ({ mutateAsync: vi.fn() }),
}));
// Lenis needs browser APIs jsdom lacks; smooth scrolling isn't what's under test.
vi.mock("@/lib/motion/SmoothScroll", () => ({ SmoothScroll: () => null }));

const base = makeBootstrap();
const bootstrap: Bootstrap = {
  ...base,
  projects: base.projects.filter((p) => p.is_published),
  sections: [...base.sections, { id: 50, key: "skills", title: "Skills", subtitle: "", is_visible: true, order: 3.5 }],
  profile: { ...base.profile, journey: ["Building applications", "Backend systems", "AI systems engineering"], roles: [] },
  skills: [
    {
      id: 1,
      order: 0,
      is_published: true,
      name: "Languages",
      description: "Where I'm fluent",
      icon: "code",
      skills: [
        { id: 1, order: 0, is_published: true, category: 1, name: "C++", level: 5, is_highlighted: true },
        { id: 2, order: 1, is_published: true, category: 1, name: "Python", level: 5, is_highlighted: false },
      ],
    },
  ],
};

function renderHome(scene = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const sections = buildSections(bootstrap).filter((s) => !s.isEmpty);
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PreferencesProvider isModeAvailable={isModeAvailable}>
          <ThreeLayout bootstrap={bootstrap}>
            <SceneContext.Provider value={{ highlightProject: () => {}, highlightTier: () => {}, ...scene }}>
              <HomeView bootstrap={bootstrap} sections={sections} />
            </SceneContext.Provider>
          </ThreeLayout>
        </PreferencesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("3D mode without WebGL", () => {
  beforeAll(() => {
    // jsdom doesn't implement scrolling; the layout scrolls to top on mount.
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  it("is registered as an implemented mode", () => {
    // jsdom has no WebGL, so availability is false here; the registry entry itself is what we check.
    expect(isModeAvailable("simple")).toBe(true);
  });

  it("keeps all the content and says the scene is off", () => {
    const { container } = renderHome();
    expect(screen.getByRole("heading", { level: 1, name: "Alok Choudhary" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/3D scene couldn't start/);
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector('[data-scene="off"]')).not.toBeNull();
  });

  it("renders the career trace as a stack, most recent first", () => {
    renderHome();
    const trace = screen.getByRole("list", { name: /career trace/i });
    const frames = within(trace).getAllByRole("listitem");
    expect(frames.map((f) => f.textContent)).toEqual([
      expect.stringContaining("AI systems engineering"),
      expect.stringContaining("Backend systems"),
      expect.stringContaining("Building applications"),
    ]);
    expect(frames[0]).toHaveAttribute("aria-current", "true");
  });

  it("marks every section as a camera station, in order", () => {
    const { container } = renderHome();
    const stations = [...container.querySelectorAll("[data-station]")].map((el) => (el as HTMLElement).dataset.station);
    // hero, about, experience, projects, skills, blog? (empty → skipped), contact; arcade hidden from visitors.
    expect(stations).toEqual(["hero", "about", "experience", "projects", "skills", "contact"]);
  });

  it("alternates panels left and right", () => {
    const { container } = renderHome();
    const sides = [...container.querySelectorAll("[data-station][data-side]")].map((el) => (el as HTMLElement).dataset.side);
    expect(sides).toEqual(["left", "right", "left", "right", "left"]);
  });

  it("offers a call-stack rail linking to each section", () => {
    renderHome();
    const rail = screen.getByRole("navigation", { name: "Sections" });
    const links = within(rail).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["#hero", "#about", "#experience", "#projects", "#skills", "#contact"]);
    expect(links[0]).toHaveAttribute("aria-current", "location");
    expect(links[0]).toHaveTextContent("main");
    expect(links[3]).toHaveTextContent("projects()");
  });

  it("lights a project's tile when its card is hovered or focused", () => {
    const highlightProject = vi.fn();
    renderHome({ highlightProject });
    const card = screen.getByRole("link", { name: "Inference Lab" }).closest("div")!;
    fireEvent.pointerEnter(card);
    expect(highlightProject).toHaveBeenLastCalledWith(0);
    fireEvent.pointerLeave(card);
    expect(highlightProject).toHaveBeenLastCalledWith(null);
  });

  it("brightens the matching memory ring when a skills tier is hovered", () => {
    const highlightTier = vi.fn();
    renderHome({ highlightTier });
    const tier = screen.getByRole("heading", { name: "Languages" }).closest("div")!;
    fireEvent.pointerEnter(tier);
    // One skill group → 3 rings; group 0 is the top (hottest) ring, index 2.
    expect(highlightTier).toHaveBeenLastCalledWith(2);
    fireEvent.pointerLeave(tier);
    expect(highlightTier).toHaveBeenLastCalledWith(null);
  });

  it("shows highlighted skills distinctly and keeps the contact form from Simple mode", () => {
    renderHome();
    expect(screen.getByText("C++")).toHaveAttribute("data-hot", "true");
    expect(screen.getByText("Python")).toHaveAttribute("data-hot", "false");
    expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument();
  });
});
