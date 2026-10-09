import clsx from "clsx";
import { forwardRef } from "react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconOnly?: boolean;
  loading?: boolean;
  children?: ReactNode;
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Buttons. `iconOnly` buttons must receive an `aria-label`.
 * Variants: primary (flame fill), secondary (outlined), ghost (text), danger.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, iconOnly, loading, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={clsx(styles.btn, styles[variant], styles[size], iconOnly && styles.iconOnly, className)}
      aria-busy={loading || undefined}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden /> : icon ? <Icon name={icon} /> : null}
      {iconOnly ? null : children}
    </button>
  );
});

type LinkButtonProps = CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; href?: string };

/** Same look as Button, rendered as a router Link (`to`) or external anchor (`href`). */
export function LinkButton({
  variant = "secondary",
  size = "md",
  icon,
  iconOnly,
  className,
  children,
  to,
  href,
  ...rest
}: LinkButtonProps) {
  const cls = clsx(styles.btn, styles[variant], styles[size], iconOnly && styles.iconOnly, className);
  const content = (
    <>
      {icon ? <Icon name={icon} /> : null}
      {iconOnly ? null : children}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <a href={href} className={cls} {...rest}>
      {content}
    </a>
  );
}
