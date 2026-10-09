/**
 * 3D-mode page views. Home maps each SectionModel to a station (custom
 * presenters for hero / experience / projects / skills, Simple components in
 * a glass panel for the rest). Detail pages reuse Simple's article views
 * inside a panel while the scene idles behind them.
 */
import type { ComponentType } from "react";

import type { Bootstrap, SectionKey } from "@/api/types";
import type { AnySectionModel } from "@/domain/sections";
import { ContactSection } from "@/modes/simple/sections/ContactSection";
import {
  AboutSection,
  AchievementsSection,
  ArcadeSection,
  BlogSection,
  EducationSection,
  FocusSection,
} from "@/modes/simple/sections/content";
import { BlogIndexView as SimpleBlogIndex, NotFoundView as SimpleNotFound, PostView as SimplePost, ProjectView as SimpleProject } from "@/modes/simple/views";
import type { SectionProps } from "@/modes/types";
import { useSudo } from "@/sudo/SudoProvider";

import { DetailPanel, ExperienceStation, HeroStation, ProjectsStation, SkillsStation, Station } from "./sections";
import type { Side } from "./sections";

type AnyProps = SectionProps<SectionKey>;

/** Sections presented by reusing the Simple components inside a panel. */
const REUSED: Partial<Record<SectionKey, ComponentType<AnyProps>>> = {
  about: AboutSection as ComponentType<AnyProps>,
  focus: FocusSection as ComponentType<AnyProps>,
  education: EducationSection as ComponentType<AnyProps>,
  achievements: AchievementsSection as ComponentType<AnyProps>,
  blog: BlogSection as ComponentType<AnyProps>,
  arcade: ArcadeSection as ComponentType<AnyProps>,
  contact: ContactSection as ComponentType<AnyProps>,
};

export function HomeView({ bootstrap, sections }: { bootstrap: Bootstrap; sections: AnySectionModel[] }) {
  const { editing } = useSudo();
  let placed = 0;

  return (
    <>
      {sections.map((model) => {
        if (model.key === "hero") return <HeroStation key="hero" model={model} bootstrap={bootstrap} />;
        // Games ship later; Simple's Arcade placeholder is only visible to the owner.
        if (model.key === "arcade" && !editing) return null;

        // Panels alternate sides so the scene stays visible next to the text.
        const side: Side = placed++ % 2 === 0 ? "left" : "right";
        switch (model.key) {
          case "experience":
            return <ExperienceStation key={model.key} model={model} bootstrap={bootstrap} side={side} />;
          case "projects":
            return <ProjectsStation key={model.key} model={model} bootstrap={bootstrap} side={side} />;
          case "skills":
            return <SkillsStation key={model.key} model={model} bootstrap={bootstrap} side={side} />;
          default: {
            const Reused = REUSED[model.key];
            if (!Reused) return null;
            return (
              <Station key={model.key} name={model.key} side={side} wide={model.key === "contact" || model.key === "blog"}>
                <Reused model={model} bootstrap={bootstrap} />
              </Station>
            );
          }
        }
      })}
    </>
  );
}

export function ProjectView(props: { bootstrap: Bootstrap; slug: string }) {
  return (
    <DetailPanel>
      <SimpleProject {...props} />
    </DetailPanel>
  );
}

export function BlogIndexView(props: { bootstrap: Bootstrap }) {
  return (
    <DetailPanel>
      <SimpleBlogIndex {...props} />
    </DetailPanel>
  );
}

export function PostView(props: { bootstrap: Bootstrap; slug: string }) {
  return (
    <DetailPanel>
      <SimplePost {...props} />
    </DetailPanel>
  );
}

export function NotFoundView(props: { bootstrap: Bootstrap }) {
  return (
    <DetailPanel>
      <SimpleNotFound {...props} />
    </DetailPanel>
  );
}
