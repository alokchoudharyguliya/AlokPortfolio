/**
 * Sudo login: password step, then (if enabled) a 6-digit authenticator code.
 * Reached via /sudo/login, the `sudo` keyboard shortcut, or the
 * Terminal mode's `sudo login` command (which opens this page).
 */
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { useLogin, useMe, useVerifyOtp } from "@/api/auth";
import { ApiError } from "@/api/client";
import { shake } from "@/lib/motion/anime";
import { Button } from "@/ui/Button";
import formStyles from "@/ui/form/Form.module.css";

import styles from "./dashboard/Dashboard.module.css";

export function LoginPage() {
  const me = useMe();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/sudo";
  const login = useLogin();
  const verify = useVerifyOtp();
  const [challenge, setChallenge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Sudo login";
  }, []);

  useEffect(() => {
    if (challenge) codeRef.current?.focus();
  }, [challenge]);

  if (me.data?.authenticated) return <Navigate to={next} replace />;

  const fail = (err: unknown) => {
    setError(err instanceof ApiError ? err.message : "Couldn't reach the server. Try again.");
    shake(panelRef.current);
  };

  const onPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await login.mutateAsync({
        username: String(form.get("username")),
        password: String(form.get("password")),
      });
      if (res.otp_required) setChallenge(res.challenge);
      else navigate(next, { replace: true });
    } catch (err) {
      fail(err);
    }
  };

  const onCode = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const code = String(new FormData(e.currentTarget).get("code")).replace(/\s/g, "");
    try {
      await verify.mutateAsync({ challenge: challenge!, code });
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === "challenge_expired") setChallenge(null);
      fail(err);
    }
  };

  return (
    <main className={styles.loginScreen}>
      <div ref={panelRef} className={styles.loginPanel}>
        <p className={styles.prompt} aria-hidden>
          $ sudo -i
        </p>
        <h1 className={styles.loginTitle}>{challenge ? "Enter your code" : "Owner login"}</h1>

        {challenge ? (
          <form className={styles.loginForm} onSubmit={onCode}>
            <label className={formStyles.field}>
              <span className={formStyles.label}>6-digit code from your authenticator app</span>
              <input ref={codeRef} name="code" className={formStyles.input} inputMode="numeric"
                autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required />
            </label>
            {error ? <p className={formStyles.error} role="alert">{error}</p> : null}
            <Button type="submit" variant="primary" loading={verify.isPending}>
              Verify and continue
            </Button>
            <Button variant="ghost" onClick={() => setChallenge(null)}>
              Use a different account
            </Button>
          </form>
        ) : (
          <form className={styles.loginForm} onSubmit={onPassword}>
            <label className={formStyles.field}>
              <span className={formStyles.label}>Username</span>
              <input name="username" className={formStyles.input} autoComplete="username" required autoFocus />
            </label>
            <label className={formStyles.field}>
              <span className={formStyles.label}>Password</span>
              <input name="password" type="password" className={formStyles.input} autoComplete="current-password" required />
            </label>
            {error ? <p className={formStyles.error} role="alert">{error}</p> : null}
            <Button type="submit" variant="primary" loading={login.isPending}>
              Log in
            </Button>
          </form>
        )}
        <Link to="/" className={styles.loginBack}>
          Back to the site
        </Link>
      </div>
    </main>
  );
}
