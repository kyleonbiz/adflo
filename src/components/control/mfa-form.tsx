"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeNext } from "@/lib/safe-redirect";
import { createBrowserSupabase } from "@/lib/supabase/browser";

function CodeField({ code, setCode, error }: { code: string; setCode: (v: string) => void; error: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="mfa-code">6-digit code</Label>
      <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} aria-invalid={!!error}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="text-center text-lg tracking-[0.4em]" autoFocus />
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Signing in to staff access: enter the code from the authenticator app. */
export function VerifyForm({ next }: { next: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const supabase = createBrowserSupabase();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp.find((f) => f.status === "verified");
    if (!factor) { router.replace("/control/security"); return; }
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (err) { setError("That code did not work. Check the code and try again."); setBusy(false); return; }
    const target = safeNext(next, "/control");
    router.replace(target === "/control" || target.startsWith("/control/") ? target : "/control");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <CodeField code={code} setCode={setCode} error={error} />
      <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Continue"}</Button>
    </form>
  );
}

/** First-time setup: scan a QR code, then prove it works with one code. */
export function EnrollForm() {
  const router = useRouter();
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createBrowserSupabase();
      // A half-finished earlier attempt would block a new one, so clear unverified factors first.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.all ?? []) if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "AdFlo staff" });
      if (cancelled) return;
      if (err || !data) { setError("Could not start setup. Reload the page to try again."); return; }
      setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
    return () => { cancelled = true; };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!factor) return;
    setBusy(true); setError("");
    const { error: err } = await createBrowserSupabase().auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (err) { setError("That code did not work. Check the code and try again."); setBusy(false); return; }
    router.replace("/control");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Open an authenticator app (Google Authenticator, 1Password, Authy).</li>
        <li>Scan this code, or type the key below it.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      {factor ? (
        <div className="space-y-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={factor.qr} alt="QR code for your authenticator app" width={176} height={176} className="mx-auto rounded-lg border bg-white p-2" />
          <p className="break-all font-mono text-xs text-muted-foreground">{factor.secret}</p>
        </div>
      ) : !error && <p className="text-center text-sm text-muted-foreground">Preparing your code…</p>}
      <CodeField code={code} setCode={setCode} error={error} />
      <Button type="submit" className="w-full" disabled={busy || !factor || code.length !== 6}>{busy ? "Checking…" : "Turn on two-factor"}</Button>
    </form>
  );
}
