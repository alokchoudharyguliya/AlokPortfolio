/**
 * Central query-key factory. Mutations invalidate by these prefixes, so an
 * edit made from the dashboard, an inline editor or (later) a terminal
 * command refreshes every mode's view of the same data.
 */
export const qk = {
  bootstrap: (drafts: boolean) => ["bootstrap", { drafts }] as const,
  bootstrapAll: ["bootstrap"] as const,
  posts: (page: number, tag?: string) => ["public", "posts", { page, tag }] as const,
  post: (slug: string) => ["public", "post", slug] as const,
  me: ["auth", "me"] as const,
  admin: (endpoint: string, query?: object) =>
    query ? (["admin", endpoint, query] as const) : (["admin", endpoint] as const),
  adminAll: ["admin"] as const,
};
