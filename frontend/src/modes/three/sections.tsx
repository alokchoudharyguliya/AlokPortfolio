/**
 * 3D-mode section presenters.
 *
 * Hero, Experience, Projects and Skills are staged for the scene (stack
 * trace, pipeline, die tiles, memory tiers). Every other section reuses the
 * Simple components inside a glass panel, so inline editing, forms and
 * markdown behave identically in all modes.
 *
 * Each station is an element with `data-station="<section key>"`; the camera
 * flight (useScrollFlight) is built from those elements in DOM order.
 */
import clsx from "clsx";
import { animate, stagger } from "animejs";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { Section } from "@/api/types";
import { dateRange, humanize } from "@/domain/format";
import { track } from "@/lib/analytics";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import type { SectionProps } from "@/modes/types";
import { SocialLinks, TagList } from "@/modes/simple/parts";
import { EditableItem, EditableSection } from "@/sudo/inline/Editable";
import { LinkButton } from "@/ui/Button";

import { useScene } from "./SceneContext";
import { useReveal } from "./useReveal";
import { ringCount, tierRing } from "./scene/stations";
import styles from "./Three.module.css";

export type Side = "left" | "right";

/** A scroll stop: a section's panel plus the marker the camera flight is built from. */
export function Station({ name, side, wide = false, children }: { name: string; side: Side; wide?: boolean; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useReveal(panel);
  return (
    <div className={styles.station} data-station={name} data-side={side}>
      <div ref={panel} className={clsx(styles.glass, wide && styles.wide)}>
        {children}
      </div>
    </div>
  );
}

/** Panel for detail pages (project, post, 404): the scene idles behind it. */
export function DetailPanel({ children }: { children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useReveal(panel);
  return (
    <div className={styles.detail}>
      <div ref={panel} className={styles.glass}>
        {children}
      </div>
    </div>
  );
}

function PanelHead({ meta, kicker }: { meta: Section; kicker: string }) {
  return (
    <header className={styles.panelHead}>
      <p className={styles.eyebrow}>{kicker}</p>
      <h2 id={`${meta.key}-title`} className={styles.panelTitle}>
        {meta.title}
      </h2>
      {meta.subtitle ? <p className={styles.panelSub}>{meta.subtitle}</p> : null}
    </header>
  );
}

// ------------------------------------------------------------------- hero

export function HeroStation({ model }: SectionProps<"hero">) {
  const { profile, socials, resume } = model.data;
  // A stack trace lists the most recent call first, so the career reads from "now" down to "where it started".
  const frames = [...profile.journey].reverse();

  return (
    <EditableSection meta={model.meta}>
      <section id="hero" data-station="hero" className={styles.hero} aria-labelledby="hero-name">
        <div className={styles.heroCopy}>
          {profile.headline ? <p className={styles.eyebrow}>{profile.headline}</p> : null}
          <h1 id="hero-name" className={styles.heroName}>
            {profile.full_name}
          </h1>
          {profile.tagline ? <p className={styles.heroTag}>{profile.tagline}</p> : null}
        </div>

        <StackTrace frames={frames} />

        <div className={styles.actions}>
          <LinkButton href="#projects" variant="primary" icon="folder">
            See projects
          </LinkButton>
          {resume ? (
            <LinkButton
              href={resume.url}
              icon="download"
              target="_blank"
              rel="noreferrer"
              onClick={() => track("resume_download", { label: resume.label })}
            >
              Download resume
            </LinkButton>
          ) : null}
          <LinkButton href="#contact" variant="ghost" icon="mail">
            Get in touch
          </LinkButton>
          <SocialLinks links={socials} />
        </div>
        {profile.is_available && profile.availability ? (
          <p className={styles.availability}>
            <span className={styles.pulse} aria-hidden />
            {profile.availability}
          </p>
        ) : null}
        <ScrollCue />
      </section>
    </EditableSection>
  );
}

/** The career trace as a call stack: the camera's descent through the page mirrors it. */
function StackTrace({ frames }: { frames: string[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const list = ref.current;
    if (!list || reduced || !frames.length) return;
    const anim = animate(list.children, {
      opacity: [0, 1],
      translateX: [-16, 0],
      delay: stagger(120, { start: 1100 }),
      duration: 520,
      ease: "outQuad",
    });
    return () => {
      anim.revert();
    };
  }, [reduced, frames.length]);

  if (!frames.length) return null;
  return (
    <div>
      <p className={styles.traceCaption}>Career trace, most recent call first</p>
      <ol ref={ref} className={styles.trace} aria-label="Career trace, most recent first">
        {frames.map((frame, i) => (
          <li key={frame} aria-current={i === 0 ? "true" : undefined}>
            <span className={styles.traceIdx}>#{i}</span>
            <span>
              {frame}
              {i === 0 ? <span className="visually-hidden"> (current focus)</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ScrollCue() {
  const arrow = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || !arrow.current) return;
    const anim = animate(arrow.current, { translateY: [0, 6, 0], duration: 1600, ease: "inOutSine", loop: true });
    return () => {
      anim.revert();
    };
  }, [reduced]);
  return (
    <a className={styles.cue} href="#about" aria-label="Scroll down to the next section">
      scroll to descend
      <span ref={arrow} className={styles.cueArrow} aria-hidden>
        ↓
      </span>
    </a>
  );
}

// ------------------------------------------------------------- experience

export function ExperienceStation({ model, side }: SectionProps<"experience"> & { side: Side }) {
  return (
    <Station name="experience" side={side} wide>
      <EditableSection meta={model.meta}>
        <section id="experience" aria-labelledby="experience-title">
          <PanelHead meta={model.meta} kicker="pipeline" />
          <ol className={styles.pipeline}>
            {model.data.items.map((exp, i) => (
              <EditableItem key={exp.id} as="li" resource="experience" item={exp} className={styles.stage}>
                <span className={styles.node} aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {exp.start_date || exp.end_date ? <p className={styles.when}>{dateRange(exp.start_date, exp.end_date)}</p> : null}
                <h3 className={styles.itemTitle}>{exp.role}</h3>
                <p className={styles.org}>
                  {exp.organization_url ? (
                    <a href={exp.organization_url} target="_blank" rel="noreferrer noopener">
                      {exp.organization}
                    </a>
                  ) : (
                    exp.organization
                  )}
                  {` · ${humanize(exp.employment_type)}${exp.location ? `, ${exp.location}` : ""}`}
                </p>
                {exp.summary ? <p className={styles.body}>{exp.summary}</p> : null}
                {exp.highlights.length ? (
                  <ul className={styles.bullets}>
                    {exp.highlights.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                ) : null}
                <TagList tags={exp.tags} />
              </EditableItem>
            ))}
          </ol>
        </section>
      </EditableSection>
    </Station>
  );
}

// --------------------------------------------------------------- projects

export function ProjectsStation({ model, side }: SectionProps<"projects"> & { side: Side }) {
  const scene = useScene();
  return (
    <Station name="projects" side={side} wide>
      <EditableSection meta={model.meta}>
        <section id="projects" aria-labelledby="projects-title">
          <PanelHead meta={model.meta} kicker="streaming multiprocessors" />
          <ol className={styles.cards}>
            {model.data.items.map((p, i) => (
              <EditableItem key={p.id} as="li" resource="projects" item={p} className={styles.card}>
                {/* Hover or focus lights this project's tile on the die behind the panel. */}
                <div
                  className={styles.cardInner}
                  onPointerEnter={() => scene.highlightProject(i)}
                  onPointerLeave={() => scene.highlightProject(null)}
                  onFocusCapture={() => scene.highlightProject(i)}
                  onBlurCapture={() => scene.highlightProject(null)}
                >
                  <span className={styles.tile} aria-hidden>
                    SM-{String(i + 1).padStart(2, "0")} · {humanize(p.status)}
                  </span>
                  <h3 className={styles.cardTitle}>
                    <Link to={`/projects/${p.slug}`}>{p.title}</Link>
                  </h3>
                  {p.summary ? <p className={styles.body}>{p.summary}</p> : null}
                  {p.metrics.length ? (
                    <dl className={styles.metrics}>
                      {p.metrics.slice(0, 2).map((m) => (
                        <div key={m.label}>
                          <dt>{m.label}</dt>
                          <dd>{m.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <TagList tags={p.tags.slice(0, 5)} />
                </div>
              </EditableItem>
            ))}
          </ol>
        </section>
      </EditableSection>
    </Station>
  );
}

// ----------------------------------------------------------------- skills

/** Decorative names for the memory hierarchy, hottest (closest to the cores) first. */
const TIER_NAMES = ["registers", "shared memory", "L2 cache", "HBM", "host DRAM", "storage"];

export function SkillsStation({ model, side }: SectionProps<"skills"> & { side: Side }) {
  const scene = useScene();
  const rings = ringCount(model.data.categories.length);
  return (
    <Station name="skills" side={side} wide>
      <EditableSection meta={model.meta}>
        <section id="skills" aria-labelledby="skills-title">
          <PanelHead meta={model.meta} kicker="memory hierarchy" />
          <ol className={styles.tiers}>
            {model.data.categories.map((cat, i) => (
              <EditableItem key={cat.id} as="li" resource="skill-categories" item={cat} className={styles.tier}>
                <div
                  className={styles.cardInner}
                  onPointerEnter={() => scene.highlightTier(tierRing(i, rings))}
                  onPointerLeave={() => scene.highlightTier(null)}
                  onFocusCapture={() => scene.highlightTier(tierRing(i, rings))}
                  onBlurCapture={() => scene.highlightTier(null)}
                >
                  <span className={styles.tierLabel} aria-hidden>
                    L{i} · {TIER_NAMES[Math.min(i, TIER_NAMES.length - 1)]}
                  </span>
                  <h3 className={styles.itemTitle}>{cat.name}</h3>
                  {cat.description ? <p className={styles.muted}>{cat.description}</p> : null}
                  <ul className={styles.chips} aria-label={`${cat.name} skills`}>
                    {(cat.skills ?? []).map((s) => (
                      <li key={s.id} data-hot={s.is_highlighted}>
                        {s.name}
                      </li>
                    ))}
                  </ul>
                </div>
              </EditableItem>
            ))}
          </ol>
        </section>
      </EditableSection>
    </Station>
  );
}
