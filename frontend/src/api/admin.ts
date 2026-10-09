/**
 * Owner-side data hooks.
 *
 * The generic `useAdminList` / `useAdminMutations` / `useSingleton` hooks back
 * every editable resource. The dashboard's ResourcePage and the inline
 * EditDrawer both call these, so there is exactly one write path per resource.
 * Every successful write invalidates the admin cache for that endpoint AND the
 * public bootstrap, so all presentation modes re-render with the new content.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

import { api, request } from "./client";
import { qk } from "./queryKeys";
import type {
  AnalyticsSummary,
  MediaAsset,
  Overview,
  Paginated,
  VersionDetail,
  VersionSummary,
} from "./types";

type Query = Record<string, string | number | boolean | undefined>;

function unwrap<T>(data: T[] | Paginated<T>): T[] {
  return Array.isArray(data) ? data : data.results;
}

/** List a collection endpoint, e.g. "projects" → GET /admin/projects/. */
export function useAdminList<T>(endpoint: string, query?: Query, enabled = true) {
  return useQuery({
    queryKey: qk.admin(endpoint, query),
    queryFn: async () => unwrap(await api.get<T[] | Paginated<T>>(`/admin/${endpoint}/`, query)),
    enabled,
  });
}

/** One object of a collection, e.g. GET /admin/projects/3/ (disabled when id is null). */
export function useAdminItem<T>(endpoint: string, id: number | null | undefined) {
  return useQuery({
    queryKey: qk.admin(endpoint, { id }),
    queryFn: () => api.get<T>(`/admin/${endpoint}/${id}/`),
    enabled: id != null,
  });
}

export function useAdminPage<T>(endpoint: string, query?: Query) {
  return useQuery({
    queryKey: qk.admin(endpoint, query),
    queryFn: () => api.get<Paginated<T>>(`/admin/${endpoint}/`, query),
  });
}

/** Refresh everything a write to `endpoint` can change: admin cache, public bootstrap, history. */
export function invalidateContent(qc: QueryClient, endpoint: string) {
  qc.invalidateQueries({ queryKey: qk.admin(endpoint) });
  qc.invalidateQueries({ queryKey: qk.bootstrapAll });
  qc.invalidateQueries({ queryKey: ["public"] });
  qc.invalidateQueries({ queryKey: qk.admin("versions") });
}

function useInvalidate(endpoint: string) {
  const qc = useQueryClient();
  return () => invalidateContent(qc, endpoint);
}

/**
 * Imperative PATCH for callers that cannot use hooks (Terminal commands pick
 * the endpoint at run time). Same URL and invalidation as `useAdminMutations`
 * / `useSingleton`; pass `id = null` for singletons such as "profile".
 */
export async function patchAdmin<T = unknown>(
  qc: QueryClient,
  endpoint: string,
  id: number | null,
  patch: Record<string, unknown>,
): Promise<T> {
  const path = id === null ? `/admin/${endpoint}/` : `/admin/${endpoint}/${id}/`;
  const result = await api.patch<T>(path, patch);
  invalidateContent(qc, endpoint);
  return result;
}

export function useAdminMutations<T extends { id: number }>(endpoint: string) {
  const invalidate = useInvalidate(endpoint);
  const base = `/admin/${endpoint}/`;

  const create = useMutation({
    mutationFn: (body: Partial<T>) => api.post<T>(base, body),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<T> }) =>
      api.patch<T>(`${base}${id}/`, patch),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.del(`${base}${id}/`),
    onSuccess: invalidate,
  });
  const reorder = useMutation({
    mutationFn: (ids: number[]) => api.post<{ ids: number[] }>(`${base}reorder/`, { ids }),
    onSuccess: invalidate,
  });
  return { create, update, remove, reorder };
}

/** GET/PATCH a singleton endpoint, e.g. "profile" or "site". */
export function useSingleton<T>(endpoint: string) {
  const invalidate = useInvalidate(endpoint);
  const query = useQuery({
    queryKey: qk.admin(endpoint),
    queryFn: () => api.get<T>(`/admin/${endpoint}/`),
  });
  const save = useMutation({
    mutationFn: (patch: Partial<T>) => api.patch<T>(`/admin/${endpoint}/`, patch),
    onSuccess: invalidate,
  });
  return { query, save };
}

export function useUploadMedia() {
  const invalidate = useInvalidate("media");
  return useMutation({
    mutationFn: ({ file, title, alt_text }: { file: File; title?: string; alt_text?: string }) => {
      const form = new FormData();
      form.append("file", file);
      if (title) form.append("title", title);
      if (alt_text) form.append("alt_text", alt_text);
      return request<MediaAsset>("/admin/media/", { method: "POST", body: form });
    },
    onSuccess: invalidate,
  });
}

export function useOverview() {
  return useQuery({ queryKey: qk.admin("overview"), queryFn: () => api.get<Overview>("/admin/overview/") });
}

export function useAnalytics(days: number) {
  return useQuery({
    queryKey: qk.admin("analytics", { days }),
    queryFn: () => api.get<AnalyticsSummary>("/admin/analytics/summary/", { days }),
  });
}

export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: qk.admin("messages", { unread: true }),
    queryFn: () => api.get<{ unread: number }>("/admin/messages/unread_count/"),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useMarkAllRead() {
  const invalidate = useInvalidate("messages");
  return useMutation({
    mutationFn: () => api.post<{ updated: number }>("/admin/messages/mark_all_read/"),
    onSuccess: invalidate,
  });
}

export function useVersions(query: Query) {
  return useQuery({
    queryKey: qk.admin("versions", query),
    queryFn: () => api.get<Paginated<VersionSummary>>("/admin/versions/", query),
  });
}

export function useVersion(id: number | null) {
  return useQuery({
    queryKey: qk.admin("versions", { id }),
    queryFn: () => api.get<VersionDetail>(`/admin/versions/${id}/`),
    enabled: id !== null,
  });
}

/** Restore a snapshot, then refresh every cache it may have changed. Also used imperatively by the Terminal. */
export async function restoreVersion(qc: QueryClient, id: number): Promise<VersionSummary> {
  const result = await api.post<VersionSummary>(`/admin/versions/${id}/restore/`);
  qc.invalidateQueries({ queryKey: qk.adminAll });
  qc.invalidateQueries({ queryKey: qk.bootstrapAll });
  qc.invalidateQueries({ queryKey: ["public"] });
  return result;
}

export function useRestoreVersion() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => restoreVersion(qc, id) });
}

export function useResetLeaderboard() {
  const invalidate = useInvalidate("scores");
  return useMutation({
    mutationFn: (gameId: number) => api.post<{ deleted: number }>(`/admin/games/${gameId}/reset/`),
    onSuccess: invalidate,
  });
}

