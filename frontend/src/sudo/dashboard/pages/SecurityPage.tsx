/** Two-factor (TOTP) setup and removal for the owner account. */
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { useMe, useOtpConfirm, useOtpDisable, useOtpSetup } from "@/api/auth";
import { ApiError } from "@/api/client";
import { Button } from "@/ui/Button";
import formStyles from "@/ui/form/Form.module.css";
import { useToast } from "@/ui/Toast";

import styles from "../Dashboard.module.css";

export function SecurityPage() {
  const me = useMe();
  const setup = useOtpSetup();
  const confirm = useOtpConfirm();
  const disable = useOtpDisable();
  const toast = useToast();
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasTotp = me.data?.user?.has_totp;

  useEffect(() => {
    if (setup.data) QRCode.toDataURL(setup.data.otpauth_url, { margin: 1, width: 400 }).then(setQr);
  }, [setup.data]);

  const codeFrom = (e: FormEvent<HTMLFormElement>) =>
    String(new FormData(e.currentTarget).get("code")).replace(/\s/g, "");

  const onConfirm = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      await confirm.mutateAsync(codeFrom(e));
      setQr(null);
      setup.reset();
      toast("Two-factor login is on", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't confirm the code.");
    }
  };

  const onDisable = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      await disable.mutateAsync(codeFrom(e));
      toast("Two-factor login is off", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't turn off two-factor login.");
    }
  };

  return (
    <section className={styles.stack}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Security</h1>
          <p className={styles.pageIntro}>
            Two-factor login asks for a code from an authenticator app (1Password, Google Authenticator, Authy…)
            after your password.
          </p>
        </div>
      </div>

      <div className={`${styles.panel} ${styles.stack}`}>
        <h2>Two-factor login: {hasTotp ? "on" : "off"}</h2>

        {setup.data ? (
          <form className={styles.stack} onSubmit={onConfirm}>
            <p>Scan this code with your authenticator app, then enter the 6-digit code it shows.</p>
            {qr ? <img className={styles.qr} src={qr} alt="QR code for your authenticator app" /> : null}
            <p className={styles.muted}>
              Can't scan? Enter this key manually: <span className={styles.secret}>{setup.data.secret}</span>
            </p>
            <label className={formStyles.field} style={{ maxWidth: "14rem" }}>
              <span className={formStyles.label}>Code</span>
              <input name="code" className={formStyles.input} inputMode="numeric" autoComplete="one-time-code" required />
            </label>
            {error ? <p className={formStyles.error} role="alert">{error}</p> : null}
            <div className={styles.toolbar}>
              <Button type="submit" variant="primary" loading={confirm.isPending}>Turn on two-factor login</Button>
              <Button variant="ghost" onClick={() => { setup.reset(); setQr(null); }}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div className={styles.toolbar}>
            <Button variant={hasTotp ? "secondary" : "primary"} icon="shield" loading={setup.isPending} onClick={() => setup.mutate()}>
              {hasTotp ? "Move to a new device" : "Set up two-factor login"}
            </Button>
          </div>
        )}

        {hasTotp && !setup.data ? (
          <form className={styles.stack} onSubmit={onDisable}>
            <p className={styles.muted}>To turn it off, enter a current code. Servers that require 2FA refuse this.</p>
            <label className={formStyles.field} style={{ maxWidth: "14rem" }}>
              <span className={formStyles.label}>Current code</span>
              <input name="code" className={formStyles.input} inputMode="numeric" autoComplete="one-time-code" required />
            </label>
            {error ? <p className={formStyles.error} role="alert">{error}</p> : null}
            <div>
              <Button type="submit" variant="danger" loading={disable.isPending}>Turn off two-factor login</Button>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}
