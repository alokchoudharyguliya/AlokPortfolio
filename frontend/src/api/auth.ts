/** Sudo session hooks (login → optional TOTP → cookies). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, request } from "./client";
import { qk } from "./queryKeys";
import type { LoginResponse, Me } from "./types";

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: () => request<Me>("/auth/me/", { retryOnAuth: false }),
    staleTime: 5 * 60_000,
  });
}

/** Convenience: true only for a fully authenticated owner session. */
export function useIsOwner() {
  return useMe().data?.authenticated === true;
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { username: string; password: string }) =>
      api.post<LoginResponse>("/auth/login/", vars),
    onSuccess: (data) => {
      if (!data.otp_required) qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useVerifyOtp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { challenge: string; code: string }) =>
      api.post<LoginResponse>("/auth/otp/verify/", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>("/auth/logout/"),
    onSettled: () => {
      qc.setQueryData<Me>(qk.me, { authenticated: false, user: null });
      qc.removeQueries({ queryKey: qk.adminAll });
      qc.invalidateQueries({ queryKey: qk.bootstrapAll });
    },
  });
}

export function useOtpSetup() {
  return useMutation({
    mutationFn: () => api.post<{ otpauth_url: string; secret: string }>("/auth/otp/setup/"),
  });
}

export function useOtpConfirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.post<{ has_totp: boolean }>("/auth/otp/confirm/", { code }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
}

export function useOtpDisable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.post<{ has_totp: boolean }>("/auth/otp/disable/", { code }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
}
