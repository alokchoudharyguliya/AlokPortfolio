/** Viewer-side data hooks. Every presentation mode reads through these. */
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";

import { api } from "./client";
import { qk } from "./queryKeys";
import type { Bootstrap, Paginated, Post, PostSummary } from "./types";

export function useBootstrap(drafts = false) {
  return useQuery({
    queryKey: qk.bootstrap(drafts),
    queryFn: () => api.get<Bootstrap>("/public/bootstrap/", drafts ? { drafts: 1 } : undefined),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function usePosts(page = 1, tag?: string) {
  return useQuery({
    queryKey: qk.posts(page, tag),
    queryFn: () =>
      api.get<Paginated<PostSummary>>("/public/posts/", { page, tags__slug: tag }),
    placeholderData: keepPreviousData,
  });
}

/** Query definition for one post; shared by `usePost` and imperative `queryClient.fetchQuery` callers. */
export const postQuery = (slug: string) => ({
  queryKey: qk.post(slug),
  queryFn: () => api.get<Post>(`/public/posts/${slug}/`),
});

export function usePost(slug: string) {
  return useQuery({
    ...postQuery(slug),
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  });
}

export interface ContactPayload {
  name: string;
  email: string;
  subject: string;
  body: string;
  source_mode: string;
  /** Honeypot — must stay empty. */
  website: string;
}

/** Plain function form of the contact POST, for callers that cannot use hooks (Terminal `message`). */
export const submitContact = (payload: ContactPayload) => api.post<{ ok: true }>("/public/contact/", payload);

export function useSubmitContact() {
  return useMutation({ mutationFn: submitContact });
}
