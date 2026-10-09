/** Pure formatting helpers shared by every mode (and unit-tested). */

const MONTH_YEAR = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" });
const FULL_DATE = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function parse(iso: string): Date {
  // Date-only strings are parsed as UTC; keep them in UTC to avoid off-by-one days.
  return new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
}

export function monthYear(iso: string | null | undefined): string {
  return iso ? MONTH_YEAR.format(parse(iso)) : "";
}

export function fullDate(iso: string | null | undefined): string {
  return iso ? FULL_DATE.format(parse(iso)) : "";
}

/**
 * "Jan 2024 – Present", "Jan 2024 – Jun 2024", or "" when no dates are known.
 * `ongoing` lets callers decide whether a missing end means "Present".
 */
export function dateRange(start: string | null, end: string | null, ongoing = true): string {
  const s = monthYear(start);
  const e = end ? monthYear(end) : ongoing && start ? "Present" : "";
  if (s && e) return s === e ? s : `${s} – ${e}`;
  return s || e;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.round((parse(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, secs] of steps) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return "just now";
}

export function humanize(value: string): string {
  const s = value.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
