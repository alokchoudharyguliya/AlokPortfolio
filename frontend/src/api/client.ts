/**
 * Low-level HTTP client used by every query/mutation hook.
 *
 * Responsibilities
 * - Prefix requests with /api/v1 (same-origin; Vite proxy in dev, Vercel rewrite in prod).
 * - Send cookies (`credentials: "include"`) — auth lives in httpOnly JWT cookies.
 * - Attach the CSRF token to unsafe methods (Django checks it for cookie auth).
 * - On 401 from an owner endpoint, refresh the session once and retry.
 * - Normalise failures into `ApiError` carrying the backend's error envelope,
 *   so forms can map `fields` onto inputs and toasts can show `message`.
 */
import type { ApiErrorBody } from "./types";

export const API_BASE = "/api/v1";

export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string[]>;

  constructor(status: number, body: Partial<ApiErrorBody["error"]> = {}) {
    super(body.message || `Request failed (${status})`);
    this.status = status;
    this.code = body.code || "error";
    this.fields = body.fields || {};
  }
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

let csrfPromise: Promise<void> | null = null;

/** Make sure the `csrftoken` cookie exists (fetches /auth/csrf/ once). */
export function ensureCsrf(): Promise<void> {
  if (readCookie("csrftoken")) return Promise.resolve();
  csrfPromise ??= fetch(`${API_BASE}/auth/csrf/`, { credentials: "include" })
    .then(() => undefined)
    .finally(() => {
      csrfPromise = null;
    });
  return csrfPromise;
}

let refreshPromise: Promise<boolean> | null = null;

/** Rotate tokens via the refresh cookie. Concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  refreshPromise ??= (async () => {
    await ensureCsrf();
    const res = await fetch(`${API_BASE}/auth/refresh/`, {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRFToken": readCookie("csrftoken") ?? "" },
    });
    return res.ok;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Retry once after refreshing the session on 401 (default: true for /admin/). */
  retryOnAuth?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = `${API_BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const isForm = options.body instanceof FormData;
  const headers: Record<string, string> = { Accept: "application/json" };

  if (UNSAFE.has(method)) {
    await ensureCsrf();
    headers["X-CSRFToken"] = readCookie("csrftoken") ?? "";
  }
  if (options.body !== undefined && !isForm) headers["Content-Type"] = "application/json";

  const res = await fetch(buildUrl(path, options.query), {
    method,
    headers,
    credentials: "include",
    signal: options.signal,
    body:
      options.body === undefined
        ? undefined
        : isForm
          ? (options.body as FormData)
          : JSON.stringify(options.body),
  });

  const retry = options.retryOnAuth ?? path.startsWith("/admin/");
  if (res.status === 401 && retry) {
    if (await refreshSession()) {
      return request<T>(path, { ...options, retryOnAuth: false });
    }
    window.dispatchEvent(new CustomEvent("sudo:session-expired"));
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new ApiError(res.status, (data as ApiErrorBody | undefined)?.error);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body }),
  del: (path: string) => request<void>(path, { method: "DELETE" }),
};
