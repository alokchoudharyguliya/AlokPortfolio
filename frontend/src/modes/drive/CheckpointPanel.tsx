/**
 * What the visitor reads at a checkpoint. The car is parked at the gate and this
 * panel shows the section's content, reusing Simple's section components, so the
 * contact form, markdown, links and (for the owner) inline editing all work
 * exactly as in the other modes. Only the hero is Drive-specific: it doubles as
 * the start screen ("garage").
 *
 * Focus: the panel takes focus when it opens (so screen-reader users hear it and
 * Tab continues inside it); the sticky footer holds the primary action, and
 * Enter from anywhere that isn't a form control also triggers it (handled by
 * DriveLayout).
 */
import clsx from "clsx";
import { useEffect, useRef } from "react";
import type { ComponentType } from "react";

import type { Bootstrap, SectionKey } from "@/api/types";
import type { AnySectionModel } from "@/domain/sections";
import { track } from "@/lib/analytics";
import { ContactSection } from "@/modes/simple/sections/ContactSection";
import {
  AboutSection,
  AchievementsSection,
  ArcadeSection,
  BlogSection,
  EducationSection,
  ExperienceSection,
  FocusSection,
  ProjectsSection,
  SkillsSection,
} from "@/modes/simple/sections/content";
import { SocialLinks } from "@/modes/simple/parts";
import type { SectionProps } from "@/modes/types";
import { EditableSection } from "@/sudo/inline/Editable";
import { useSudo } from "@/sudo/SudoProvider";
import { Button, LinkButton } from "@/ui/Button";

import styles from "./Drive.module.css";

type AnyProps = SectionProps<SectionKey>;

const SECTION_VIEWS: Partial<Record<SectionKey, ComponentType<AnyProps>>> = {
  about: AboutSection as ComponentType<AnyProps>,
  focus: FocusSection as ComponentType<AnyProps>,
  experience: ExperienceSection as ComponentType<AnyProps>,
  projects: ProjectsSection as ComponentType<AnyProps>,
  skills: SkillsSection as ComponentType<AnyProps>,
  education: EducationSection as ComponentType<AnyProps>,
  achievements: AchievementsSection as ComponentType<AnyProps>,
  blog: BlogSection as ComponentType<AnyProps>,
  arcade: ArcadeSection as ComponentType<AnyProps>,
  contact: ContactSection as ComponentType<AnyProps>,
};

export interface CheckpointPanelProps {
  model: AnySectionModel;
  bootstrap: Bootstrap;
  index: number;
  total: number;
  /** Engine has been started at least once. */
  started: boolean;
  isLast: boolean;
  touch: boolean;
  onContinue: () => void;
  onReadAsPage: () => void;
}

export function CheckpointPanel({ model, bootstrap, index, total, started, isLast, touch, onContinue, onReadAsPage }: CheckpointPanelProps) {
  const root = useRef<HTMLDivElement>(null);
  const { editing } = useSudo();

  useEffect(() => {
    root.current?.focus({ preventScroll: true });
  }, [model.key]);

  const View = SECTION_VIEWS[model.key];
  const garage = model.key === "hero" && !started;
  const label = garage ? "Start the engine" : isLast ? "Finish the drive" : "Drive on";

  return (
    <div
      ref={root}
      className={clsx(styles.panel, editing && styles.panelEditing)}
      role="dialog"
      aria-label={`${model.meta.title}, checkpoint ${index + 1} of ${total}`}
      tabIndex={-1}
      data-key={model.key}
    >
      <div className={styles.panelScroll} data-lenis-prevent>
        <p className={styles.kicker}>{index === 0 ? "Start" : isLast ? "Finish" : `Checkpoint ${index} of ${total - 1}`}</p>
        {model.key === "hero" ? <DriveHero model={model as AnySectionModel & { key: "hero" }} touch={touch} /> : View ? <View model={model} bootstrap={bootstrap} /> : null}
      </div>
      <footer className={styles.panelFooter}>
        <Button variant="ghost" size="sm" onClick={onReadAsPage}>
          Read as a page
        </Button>
        <Button variant="primary" onClick={onContinue} className={styles.go}>
          {label}
          <kbd className={styles.kbd}>{touch ? "" : "Enter"}</kbd>
        </Button>
      </footer>
    </div>
  );
}

/** Start screen content: who this is, how to drive. */
function DriveHero({ model, touch }: { model: AnySectionModel & { key: "hero" }; touch: boolean }) {
  const { profile, socials, resume } = model.data;
  return (
    <EditableSection meta={model.meta}>
      <section className={styles.hero} aria-labelledby="drive-hero-name">
        <h1 id="drive-hero-name" className={styles.heroName}>
          {profile.full_name}
        </h1>
        {profile.headline ? <p className={styles.heroHeadline}>{profile.headline}</p> : null}
        {profile.tagline ? <p className={styles.heroTagline}>{profile.tagline}</p> : null}

        <div className={styles.controlsHelp} aria-label="How to drive">
          {touch ? (
            <>
              <p>
                <strong>Hold</strong> the left or right side of the screen to steer. The car keeps moving on its own.
              </p>
            </>
          ) : (
            <ul>
              <li>
                <kbd>←</kbd> <kbd>→</kbd> steer
              </li>
              <li>
                <kbd>↑</kbd> gas <kbd>↓</kbd> brake
              </li>
              <li>
                <kbd>Esc</kbd> menu: route map, autopilot
              </li>
            </ul>
          )}
          <p className={styles.helpNote}>Stop at each gate to read what's there. Crashes only slow you down.</p>
        </div>

        <div className={styles.heroActions}>
          {resume ? (
            <LinkButton
              href={resume.url}
              icon="download"
              size="sm"
              target="_blank"
              rel="noreferrer"
              onClick={() => track("resume_download", { label: resume.label })}
            >
              Resume
            </LinkButton>
          ) : null}
          <SocialLinks links={socials} />
        </div>
      </section>
    </EditableSection>
  );
}
