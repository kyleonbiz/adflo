"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseEnv } from "@/lib/supabase/env";

/** Where a password-reset email lands. The link signs the person in briefly so they can choose a new password. */
export function ResetPasswordForm() {
  const client = useRef<SupabaseClient | null>(null);
  const [expired, setExpired] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
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
  const shown = error || (!ready && expired ? "This link has expired or was already used. Ask AdFlo support to send a new one." : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = client.current;
    if (!c) return;
    if (password.length < 8) { setError("Use at least 8 characters."); return; }
    setBusy(true); setError("");
    const { error: err } = await c.auth.updateUser({ password });
    setBusy(false);
    if (err) { setError(err.message.includes("different") ? "Choose a password you have not used before." : "Could not change the password. Try again or ask for a new link."); return; }
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
      {shown && <p role="alert" className="text-sm text-destructive">{shown}</p>}
      <Button type="submit" className="w-full" disabled={!ready || busy}>{busy ? "Saving…" : "Change password"}</Button>
    </form>
  );
}
