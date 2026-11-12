"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The client's side: name, email, tick both boxes, accept. No signature drawn. */
export function AcceptForm({ token }: { token: string }) {
  const [f, setF] = useState({ name: "", email: "", read: false, authorized: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErrors({}); setMessage("");
    try {
      const res = await fetch("/api/agreement/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, name: f.name, email: f.email, agree: f.read && f.authorized }) });
      const json = await res.json().catch(() => null);
      if (res.ok) { setDone(true); return; }
      setErrors(json?.error?.fields ?? {}); setMessage(json?.error?.message ?? "Could not save. Try again.");
    } catch { setMessage("Could not reach the server. Try again."); } finally { setBusy(false); }
  }

  if (done) return <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">Thank you. Your acceptance is recorded.</p>;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="ag-name">Your full name</Label><Input id="ag-name" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-invalid={!!errors.name} />{errors.name && <p role="alert" className="text-xs text-destructive">{errors.name}</p>}</div>
        <div className="space-y-1.5"><Label htmlFor="ag-email">Your email</Label><Input id="ag-email" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-invalid={!!errors.email} />{errors.email && <p role="alert" className="text-xs text-destructive">{errors.email}</p>}</div>
      </div>
      <div className="space-y-2.5">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-input bg-card p-3 text-sm transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"><input type="checkbox" className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--primary)]" checked={f.read} onChange={(e) => setF({ ...f, read: e.target.checked })} /> <span>I have read and understood this agreement.</span></label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-input bg-card p-3 text-sm transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"><input type="checkbox" className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--primary)]" checked={f.authorized} onChange={(e) => setF({ ...f, authorized: e.target.checked })} /> <span>I am authorized to accept it on behalf of my company, and I agree to it.</span></label>
      </div>
      {errors.agree && <p role="alert" className="text-xs text-destructive">Tick both boxes to continue.</p>}
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={busy}>{busy ? "Saving…" : "Accept agreement"}</Button>
    </form>
  );
}
