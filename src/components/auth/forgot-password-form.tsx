"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseEnv } from "@/lib/supabase/env";

/** Asks for the account email and sends a reset link that lands on /reset-password. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) return setError("Enter a valid email address.");
    const env = getSupabaseEnv();
    if (!env) return;
    setBusy(true);
    setError("");
    const { createClient } = await import("@supabase/supabase-js");
    // The implicit flow matches the reset page, which reads the tokens straight from the link.
    const client = createClient(env.url, env.anonKey, { auth: { flowType: "implicit", persistSession: false } });
    const { error: err } = await client.auth.resetPasswordForEmail(value, { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    // Same message whether or not the account exists, so this cannot be used to find out who has one.
    if (err && err.status !== 400 && err.status !== 404 && err.status !== 422) return setError("Could not send the email. Try again in a moment.");
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          If an account exists for {email.trim()}, a reset link is on its way. Check your inbox and spam folder.
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
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">Back to log in</Link>
      </p>
    </form>
  );
}
