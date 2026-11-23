"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { staffNext } from "@/lib/control/login";

/** Email and password for AdFlo staff. The two-factor code is asked for next, on the page the Control center sends them to. */
export function StaffLoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    setBusy(true); setError("");
    try {
      const { createBrowserSupabase } = await import("@/lib/supabase/browser");
      const { error: err } = await createBrowserSupabase().auth.signInWithPassword({ email: email.trim(), password });
      if (err) { setError("Incorrect email or password."); return; }
      router.replace(staffNext(next));
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="staff-email" className="sr-only">Email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input id="staff-email" type="email" placeholder="Work email" autoComplete="email" className="auth-input" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="staff-password" className="sr-only">Password</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input id="staff-password" type={show ? "text" : "password"} placeholder="Password" autoComplete="current-password" className="auth-input pr-11" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide characters" : "Show characters"} aria-pressed={show}
            className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:text-slate-700">
            {show ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
          </button>
        </div>
        <Link href="/forgot-password" className="inline-block pt-1 text-sm font-semibold text-primary hover:underline">Forgot password?</Link>
      </div>
      {error && <p role="alert" className="py-1 pl-3 text-sm border-l-2 border-red-500 text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="auth-submit w-full" disabled={busy}>
        {busy ? "Please wait…" : "Sign in"}{!busy && <ChevronRight className="size-4" aria-hidden />}
      </Button>
      <p className="text-center text-xs text-muted-foreground">You will be asked for your two-factor code next.</p>
    </form>
  );
}
