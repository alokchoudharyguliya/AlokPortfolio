/**
 * Inline SVG icon set (24px grid, 1.75 stroke, currentColor). Inline keeps the
 * bundle free of an icon library and lets icons inherit theme colours.
 */
import type { SVGProps } from "react";

const PATHS = {
  sun: "M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  moon: "M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z",
  terminal: "m4 17 6-5-6-5m8 12h8",
  car: "M5 16.5h14M4 16.5v-4l2-5a2 2 0 0 1 1.9-1.3h8.2a2 2 0 0 1 1.9 1.3l2 5v4M7.5 13.5h.01M16.5 13.5h.01M6 16.5v2m12-2v2",
  cube: "M12 2.5 3.5 7v10L12 21.5l8.5-4.5V7L12 2.5Zm0 0v0M3.5 7 12 11.5 20.5 7M12 11.5v10",
  layout: "M4 4h16v16H4zM4 9h16M9 9v11",
  pencil: "M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z",
  plus: "M12 5v14M5 12h14",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  eyeOff: "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
  trash: "M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  close: "M18 6 6 18M6 6l12 12",
  check: "m5 12.5 4.5 4.5L19 7.5",
  external: "M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  github:
    "M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21",
  linkedin:
    "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6ZM2 9h4v12H2zM4 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z",
  xLogo: "M4 4l16 16M20 4 4 20",
  download: "M12 3v12m0 0 5-5m-5 5-5-5M4 21h16",
  arrowLeft: "M19 12H5m6-6-6 6 6 6",
  arrowUpRight: "M7 17 17 7M8 7h9v9",
  arrowUp: "M12 19V5m-6 6 6-6 6 6",
  logout: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3",
  inbox: "M3 13h5l2 3h4l2-3h5M5 4h14l2 9v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6l2-9Z",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5M12 7v5l3 3",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  image: "M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.2-1.3L14.4 3h-4l-.4 2.4a7.5 7.5 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z",
  shield: "M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Zm-3 9 2 2 4-4",
  gamepad: "M6 12h4m-2-2v4m7-1h.01M18 11h.01M17.3 5H6.7a4 4 0 0 0-4 3.6l-.7 6.6A2.6 2.6 0 0 0 4.6 18c.9 0 1.7-.5 2.2-1.2L8 15h8l1.2 1.8c.5.7 1.3 1.2 2.2 1.2a2.6 2.6 0 0 0 2.6-2.8l-.7-6.6A4 4 0 0 0 17.3 5Z",
  file: "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Zm0 0v5h5",
  copy: "M8 8h12v12H8zM16 8V4H4v12h4",
  refresh: "M20 11a8 8 0 0 0-14.9-3M4 4v4h4m-4 5a8 8 0 0 0 14.9 3M20 20v-4h-4",
  menu: "M4 7h16M4 12h16M4 17h16",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3Z",
  archive: "M3 4h18v4H3zM5 8v12h14V8M10 12h4",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.3-4.3",
  upload: "M12 21V9m0 0 5 5m-5-5-5 5M4 3h16",
  home: "M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0",
  briefcase: "M3 7h18v13H3zM8 7V4h8v3M3 12h18",
  folder: "M3 5h6l2 2h10v12H3z",
  wrench: "M14.7 6.3a4 4 0 0 0 5 5l-9.5 9.5a2.1 2.1 0 0 1-3-3l9.5-9.5a4 4 0 0 0-5-5l2.5 2.5-.6 2.4-2.4.6-2.5-2.5Z",
  book: "M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z",
  award: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm-3.5 4.5L9 22l3-1.5 3 1.5.5-2.5M8.5 13.5 7 22m8.5-8.5L17 22",
  layers: "m12 2 10 5-10 5L2 7l10-5Zm-10 10 10 5 10-5M2 17l10 5 10-5",
  cpu: "M6 6h12v12H6zM9 9h6v6H9zM9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4",
  gpu: "M2 7h20v10H2zM6 17v3m12-3v3M6 11h.01M10 11h8",
  sound: "M11 5 6 9H2v6h4l5 4V5Zm4.5 3.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13",
  mute: "M11 5 6 9H2v6h4l5 4V5Zm5 4 6 6m0-6-6 6",
  sparkles: "M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2 2m8 8 2 2M6 18l2-2m8-8 2-2",
  code: "m16 18 6-6-6-6M8 6l-6 6 6 6",
  server: "M3 4h18v7H3zM3 13h18v7H3zM7 7.5h.01M7 16.5h.01",
  brain: "M9 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h3V3H9Zm6 0a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h-3",
  database: "M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3Zm8-3v14c0 1.7-3.6 3-8 3s-8-1.3-8-3V5m16 7c0 1.7-3.6 3-8 3s-8-1.3-8-3",
  cloud: "M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9H7Z",
  gauge: "M12 14 16 9M3.5 18a10 10 0 1 1 17 0",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
} as const;

export type IconName = keyof typeof PATHS;

export function isIconName(name: string): name is IconName {
  return name in PATHS;
}

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  /** Accessible label; omit for decorative icons (aria-hidden). */
  title?: string;
}

export function Icon({ name, size = 18, title, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
