"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { TURNSTILE_SITE_KEY, Turnstile } from "./turnstile";

/** Asks for the account email and sends a reset link that lands on /reset-password. */
export function ForgotPasswordForm({ demo = false }: { demo?: boolean }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) return setError("Enter a valid email address.");
    if (demo) return setSent(true);
    const env = getSupabaseEnv();
    if (!env) return;
    if (TURNSTILE_SITE_KEY && !captcha) return setError("Please wait for the human check to finish, then try again.");
    const captchaToken = captcha ?? undefined;
    setCaptcha(null);
    setCaptchaReset((n) => n + 1);
    setBusy(true);
    setError("");
    const { createClient } = await import("@supabase/supabase-js");
    // The implicit flow matches the reset page, which reads the tokens straight from the link.
    const client = createClient(env.url, env.anonKey, { auth: { flowType: "implicit", persistSession: false } });
    const { error: err } = await client.auth.resetPasswordForEmail(value, { redirectTo: `${window.location.origin}/reset-password`, captchaToken });
    setBusy(false);
    // Same message whether or not the account exists, so this cannot be used to find out who has one.
    if (err && err.status !== 400 && err.status !== 404 && err.status !== 422) return setError("Could not send the email. Try again in a moment.");
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          If an account exists for {email.trim()}, a reset link is on its way. {demo ? "This is a demo, so no email is actually sent." : "Check your inbox and spam folder."}
        </p>
        <Button asChild className="w-full"><Link href="/login">Back to log in</Link></Button>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reset-email">Email</Label>
        <Input id="reset-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error} />
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div>
      {!demo && <Turnstile onToken={setCaptcha} resetKey={captchaReset} />}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">Back to log in</Link>
      </p>
    </form>
  );
}
