"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The client's side: type a name and email, tick the box, accept. */
export function AcceptForm({ token }: { token: string }) {
  const [f, setF] = useState({ name: "", email: "", agree: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErrors({}); setMessage("");
    try {
      const res = await fetch("/api/agreement/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, ...f }) });
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
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 size-4" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} /> <span>I have read this agreement and accept it on behalf of my company.</span></label>
      {errors.agree && <p role="alert" className="text-xs text-destructive">{errors.agree}</p>}
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Accept agreement"}</Button>
    </form>
  );
}
