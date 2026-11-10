"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABEL, STAFF_ROLES, type StaffMember, type StaffRole } from "@/lib/control/types";

const SELECT = "h-9 rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";
const ROLE_HELP: Record<StaffRole, string> = { owner: "Everything, including pricing, team and the audit log.", support: "Edit clients, run onboarding, answer support.", billing: "Read-only for now." };

/** The people who work in the Control center. Owner only. */
export function TeamPage({ staff, selfId, sample }: { staff: StaffMember[]; selfId?: string; sample?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", name: "", role: "support" as StaffRole });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(url: string, method: string, body: unknown) {
    setBusy(true); setErrors({}); setMessage("");
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (res.ok) { router.refresh(); return true; }
      setErrors(json?.error?.fields ?? {}); setMessage(json?.error?.message ?? "Could not save. Try again.");
    } catch { setMessage("Could not reach the server. Try again."); } finally { setBusy(false); }
    return false;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">People who can sign in to the Control center. Each needs an AdFlo account and sets up two-factor on first sign-in.</p>
      </div>
      {sample && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Preview with sample people.</p>}
      <ul className="divide-y rounded-2xl border bg-card shadow-panel">
        {staff.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{m.displayName}{m.userId === selfId && <span className="ml-2 text-xs font-normal text-muted-foreground">you</span>}</p><p className="truncate text-xs text-muted-foreground">{m.email}</p></div>
            <div className="flex items-center gap-2">
              {!m.active && <Badge variant="muted">Access off</Badge>}
              {sample ? <Badge variant="outline">{ROLE_LABEL[m.role]}</Badge> : (
                <>
                  <select aria-label={`Role for ${m.displayName}`} className={SELECT} value={m.role} disabled={busy} onChange={(e) => call(`/api/control/staff/${m.userId}`, "PATCH", { role: e.target.value })}>
                    {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => call(`/api/control/staff/${m.userId}`, "PATCH", { active: !m.active })}>{m.active ? "Turn off access" : "Turn on access"}</Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      {!sample && (
        <form onSubmit={async (e) => { e.preventDefault(); if (await call("/api/control/staff", "POST", form)) setForm({ email: "", name: "", role: "support" }); }} className="space-y-3 rounded-2xl border bg-card p-5 shadow-panel" noValidate>
          <h2 className="font-semibold">Add a teammate</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="st-email">Their AdFlo email</Label><Input id="st-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={!!errors.email} />{errors.email && <p role="alert" className="text-xs text-destructive">{errors.email}</p>}</div>
            <div className="space-y-1.5"><Label htmlFor="st-name">Name</Label><Input id="st-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="st-role">Role</Label><select id="st-role" className={`${SELECT} h-10 w-full`} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}>{STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
          </div>
          <p className="text-xs text-muted-foreground">{ROLE_HELP[form.role]}</p>
          <Button type="submit" disabled={busy}><UserPlus /> Add to team</Button>
        </form>
      )}
    </div>
  );
}
