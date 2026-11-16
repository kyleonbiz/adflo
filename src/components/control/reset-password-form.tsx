"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Where a password-reset email lands. The link signs the person in briefly so they can choose a new password.
 *
 * An account with an authenticator app (two-factor, such as every staff account) cannot change its password from the
 * link alone: the link only proves the email, and the database refuses a password change without the second factor.
 * So for those accounts the form also asks for the 6-digit code, checks it, and then changes the password.
 */
export function ResetPasswordForm() {
  const client = useRef<SupabaseClient | null>(null);
  const [expired, setExpired] = useState(false);
  const [ready, setReady] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const env = getSupabaseEnv();
    if (!env) return;
    // The implicit flow reads the tokens from the link; the person's normal session is untouched.
    const c = createClient(env.url, env.anonKey, { auth: { flowType: "implicit", detectSessionInUrl: true, persistSession: false } });
    client.current = c;
    const { data } = c.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") setReady(true); });
    const timer = window.setTimeout(() => setExpired(true), 6000);
    return () => { data.subscription.unsubscribe(); window.clearTimeout(timer); };
  }, []);

  // Once the link has signed the person in, find out whether this account needs its second factor to change the password.
  useEffect(() => {
    const c = client.current;
    if (!ready || !c) return;
    let live = true;
    void c.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (live && data && data.nextLevel === "aal2" && data.currentLevel !== "aal2") setNeedsCode(true);
    });
    return () => { live = false; };
  }, [ready]);

  const shown = error || (!ready && expired ? "This link has expired or was already used. Ask AdFlo support to send a new one." : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = client.current;
    if (!c) return;
    if (password.length < 8) { setError("Use at least 8 characters."); return; }
    if (needsCode && !/^\d{6}$/.test(code)) { setError("Enter the 6-digit code from your authenticator app."); return; }
    setBusy(true); setError("");

    if (needsCode) {
      const { data: factors } = await c.auth.mfa.listFactors();
      const factor = factors?.totp.find((f) => f.status === "verified");
      if (!factor) { setBusy(false); setError("This account has no working authenticator. Ask AdFlo support for help."); return; }
      const { error: verifyErr } = await c.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (verifyErr) { setBusy(false); setError("That code did not work. Check the code and try again."); return; }
    }

    const { error: err } = await c.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      if ((err as { code?: string }).code === "insufficient_aal") { setNeedsCode(true); setError("Enter the 6-digit code from your authenticator app, then try again."); return; }
      setError(err.message.includes("different") ? "Choose a password you have not used before." : "Could not change the password. Try again or ask for a new link.");
      return;
    }
    await c.auth.signOut();
    setDone(true);
  }

  if (done) return <div className="space-y-4"><p className="text-sm">Your password is changed. Sign in with the new one.</p><Button asChild className="w-full"><Link href="/login">Go to sign in</Link></Button></div>;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="new-password">New password</Label>
        <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={!ready} aria-invalid={!!shown} />
      </div>
      {needsCode && (
        <div className="space-y-1.5">
          <Label htmlFor="reset-code">6-digit code from your authenticator app</Label>
          <Input id="reset-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="text-center text-lg tracking-[0.4em]" />
          <p className="text-xs text-muted-foreground">Two-factor is on for this account, so a code is needed to change the password. Lost your authenticator? Ask AdFlo support.</p>
        </div>
      )}
      {shown && <p role="alert" className="text-sm text-destructive">{shown}</p>}
      <Button type="submit" className="w-full" disabled={!ready || busy}>{busy ? "Saving…" : "Change password"}</Button>
    </form>
  );
}
