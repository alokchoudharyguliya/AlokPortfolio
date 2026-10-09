/**
 * First-party analytics beacon → POST /api/v1/public/analytics/collect/.
 *
 * - No cookies and no third-party scripts; the server hashes IP+UA per day.
 * - Disabled while the owner is logged in, or when the site turns analytics off.
 * - Uses `navigator.sendBeacon` so events survive page unloads.
 */
import { deviceClass } from "./device";

export type EventKind =
  | "pageview"
  | "mode_switch"
  | "theme_switch"
  | "game_play"
  | "resume_download"
  | "outbound_click"
  | "terminal_command";

const state = { enabled: false, referrerSent: false };

export function setAnalyticsEnabled(enabled: boolean) {
  state.enabled = enabled;
}

export function track(kind: EventKind, props: Record<string, unknown> = {}) {
  if (!state.enabled) return;
  const html = document.documentElement;
  const payload = {
    kind,
    path: window.location.pathname.slice(0, 300),
    mode: html.dataset.mode ?? "",
    theme: html.dataset.theme ?? "",
    device: deviceClass(),
    // Only the first pageview of a visit carries the external referrer.
    referrer:
      !state.referrerSent && document.referrer && !document.referrer.startsWith(location.origin)
        ? document.referrer
        : "",
    props,
  };
  if (kind === "pageview") state.referrerSent = true;

  const url = "/api/v1/public/analytics/collect/";
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }))) return;
  } catch {
    /* fall through to fetch */
  }
  fetch(url, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(
    () => {},
  );
}
