/**
 * Public game endpoints: signed play session → score submit → leaderboard.
 * See backend/apps/games: a score is rejected unless it comes with a session
 * token that is old enough for the claimed duration, so start the session when
 * play begins and submit when it ends.
 */
import { useQuery } from "@tanstack/react-query";

import { api } from "./client";

export interface LeaderboardEntry {
  nickname: string;
  score: number;
  duration_ms: number;
  created_at: string;
}

export interface SubmitResult {
  rank: number;
  leaderboard: LeaderboardEntry[];
}

export const ROAD_TRIP = "road-trip";

export function startGameSession(slug: string) {
  return api.post<{ token: string }>(`/public/games/${slug}/session/`).then((r) => r.token);
}

export function submitScore(slug: string, body: { token: string; nickname: string; score: number; duration_ms: number }) {
  return api.post<SubmitResult>(`/public/games/${slug}/scores/`, body);
}

export function useLeaderboard(slug: string, enabled = true) {
  return useQuery({
    queryKey: ["public", "leaderboard", slug],
    queryFn: () => api.get<LeaderboardEntry[]>(`/public/games/${slug}/leaderboard/`),
    enabled,
    staleTime: 30_000,
  });
}
