/**
 * Hero: name set large in a condensed width, headline + tagline, a quietly
 * rotating role line, primary actions, and the TraceHero signature below.
 */
import { useEffect, useState } from "react";

import { track } from "@/lib/analytics";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import type { SectionProps } from "@/modes/types";
import { EditableSection } from "@/sudo/inline/Editable";
import { LinkButton } from "@/ui/Button";

import { SocialLinks } from "../parts";
import styles from "./Hero.module.css";
import { TraceHero } from "./TraceHero";

export function HeroSection({ model }: SectionProps<"hero">) {
  const { profile, socials, resume } = model.data;

  return (
    <EditableSection meta={model.meta}>
      <section id="hero" className={styles.hero} aria-labelledby="hero-name">
        <div className={styles.intro}>
          <h1 id="hero-name" className={styles.name}>
            {profile.full_name}
          </h1>
          <div className={styles.lede}>
            {profile.headline ? <p className={styles.headline}>{profile.headline}</p> : null}
            <RotatingRoles roles={profile.roles} />
            {profile.tagline ? <p className={styles.tagline}>{profile.tagline}</p> : null}
          </div>
        </div>

        <TraceHero stages={profile.journey} />

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
      </section>
    </EditableSection>
  );
}

/** Cycles through roles every few seconds; static (first role) under reduced motion. */
function RotatingRoles({ roles }: { roles: string[] }) {
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || roles.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % roles.length), 3200);
    return () => window.clearInterval(id);
  }, [reduced, roles.length]);

  if (!roles.length) return null;
  return (
    <p className={styles.roles}>
      <span className="visually-hidden">Roles: {roles.join(", ")}</span>
      <span key={index} className={styles.role} aria-hidden>
        {roles[index % roles.length]}
      </span>
    </p>
  );
}
