/**
 * Contact: a short form (POST /public/contact/) beside direct links.
 * The `website` input is a honeypot hidden from people and screen readers.
 */
import { useRef, useState } from "react";
import type { FormEvent, ReactElement } from "react";

import { ApiError } from "@/api/client";
import { useSubmitContact } from "@/api/public";
import { rippleChildren, shake } from "@/lib/motion/anime";
import { usePreferences } from "@/lib/preferences/PreferencesProvider";
import type { SectionProps } from "@/modes/types";
import { Button } from "@/ui/Button";
import formStyles from "@/ui/form/Form.module.css";

import { SectionFrame, SocialLinks } from "../parts";
import styles from "../Sections.module.css";

const EMPTY = { name: "", email: "", subject: "", body: "", website: "" };

export function ContactSection({ model }: SectionProps<"contact">) {
  const { profile, socials } = model.data;
  const { mode } = usePreferences();
  const submit = useSubmitContact();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      await submit.mutateAsync({ ...values, source_mode: mode });
      setSent(true);
      setValues(EMPTY);
      requestAnimationFrame(() => rippleChildren(doneRef.current));
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k, v.join(" ")])));
        if (err.status === 429) setErrors({ form: "Too many messages from this connection. Try again later." });
      } else {
        setErrors({ form: "Couldn't send. Check your connection and try again." });
      }
      shake(formRef.current);
    }
  };

  return (
    <SectionFrame meta={model.meta}>
      <div className={styles.contact}>
        <div className={styles.contactAside}>
          {profile.email ? (
            <p>
              Email{" "}
              <a href={`mailto:${profile.email}`} className={styles.email}>
                {profile.email}
              </a>
            </p>
          ) : null}
          <SocialLinks links={socials} withLabels />
        </div>

        {sent ? (
          <div ref={doneRef} className={styles.sent} role="status">
            <p className={styles.itemTitle}>Message sent.</p>
            <p className={styles.muted}>Thanks — I'll reply to the email you gave.</p>
            <Button size="sm" variant="ghost" onClick={() => setSent(false)}>
              Send another
            </Button>
          </div>
        ) : (
          <form ref={formRef} className={styles.contactForm} onSubmit={onSubmit} noValidate>
            <Field label="Name" error={errors.name}>
              <input className={formStyles.input} autoComplete="name" required value={values.name} onChange={set("name")} />
            </Field>
            <Field label="Email" error={errors.email}>
              <input className={formStyles.input} type="email" autoComplete="email" required value={values.email}
                onChange={set("email")} />
            </Field>
            <Field label="Subject" error={errors.subject} wide>
              <input className={formStyles.input} value={values.subject} onChange={set("subject")} />
            </Field>
            <Field label="Message" error={errors.body} wide>
              <textarea className={formStyles.textarea} required minLength={10} rows={5} value={values.body}
                onChange={set("body")} />
            </Field>
            <div className={styles.honeypot} aria-hidden>
              <label>
                Website
                <input tabIndex={-1} autoComplete="off" value={values.website} onChange={set("website")} />
              </label>
            </div>
            {errors.form ? <p className={formStyles.error} role="alert">{errors.form}</p> : null}
            <div className={styles.wide}>
              <Button type="submit" variant="primary" icon="mail" loading={submit.isPending}>
                Send message
              </Button>
            </div>
          </form>
        )}
      </div>
    </SectionFrame>
  );
}

function Field({ label, error, wide, children }: { label: string; error?: string; wide?: boolean; children: ReactElement }) {
  return (
    <label className={`${formStyles.field} ${wide ? styles.wide : ""}`}>
      <span className={formStyles.label}>{label}</span>
      {children}
      {error ? <span className={formStyles.error}>{error}</span> : null}
    </label>
  );
}
