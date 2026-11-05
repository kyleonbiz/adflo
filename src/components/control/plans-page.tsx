"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, type Plan } from "@/lib/control/types";
import { FEATURES, TIERS } from "@/lib/control/tiers";

/** Plans and what they cost. Only the Owner can change them; everyone else sees the list. */
export function PlansPage({ plans, canEdit, sample }: { plans: Plan[]; canEdit: boolean; sample?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", price: "", seatsIncluded: "3" });
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
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await call("/api/control/plans", "POST", form)) setForm({ name: "", price: "", seatsIncluded: "3" });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plans &amp; pricing</h1>
        <p className="text-sm text-muted-foreground">What each plan costs per month and how many seats it includes. Clients can also have their own price.</p>
      </div>
      {sample && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Preview with sample plans.</p>}
      <div className="overflow-x-auto rounded-2xl border bg-card shadow-panel">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Plan</th><th className="px-4 py-3 text-right font-medium">Price / month</th><th className="px-4 py-3 text-right font-medium">Seats included</th><th className="px-4 py-3 font-medium">Status</th></tr></thead>
          <tbody className="divide-y">
            {plans.map((p) => (
              <PlanRow key={p.id} plan={p} canEdit={canEdit && !sample} busy={busy} onSave={(body) => call(`/api/control/plans/${p.id}`, "PATCH", body)} />
            ))}
          </tbody>
        </table>
      </div>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <div className="space-y-3">
        <div>
          <h2 className="font-semibold">What each plan includes</h2>
          <p className="text-sm text-muted-foreground">Tick what a plan offers. A plan with nothing recorded (such as the older &ldquo;standard&rdquo;) includes everything.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {plans.map((p) => (
            <FeaturePicker key={p.id} plan={p} blurb={TIERS.find((t) => t.name === p.name)?.blurb} canEdit={canEdit && !sample} busy={busy} onSave={(features) => call(`/api/control/plans/${p.id}`, "PATCH", { features })} />
          ))}
        </div>
      </div>
      {canEdit && !sample && (
        <form onSubmit={add} className="space-y-3 rounded-2xl border bg-card p-5 shadow-panel" noValidate>
          <h2 className="font-semibold">Add a plan</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="pl-name">Name</Label><Input id="pl-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!errors.name} />{errors.name && <p role="alert" className="text-xs text-destructive">{errors.name}</p>}</div>
            <div className="space-y-1.5"><Label htmlFor="pl-price">Price per month ($)</Label><Input id="pl-price" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} aria-invalid={!!errors.price} />{errors.price && <p role="alert" className="text-xs text-destructive">{errors.price}</p>}</div>
            <div className="space-y-1.5"><Label htmlFor="pl-seats">Seats included</Label><Input id="pl-seats" inputMode="numeric" value={form.seatsIncluded} onChange={(e) => setForm({ ...form, seatsIncluded: e.target.value })} aria-invalid={!!errors.seatsIncluded} />{errors.seatsIncluded && <p role="alert" className="text-xs text-destructive">{errors.seatsIncluded}</p>}</div>
          </div>
          <Button type="submit" disabled={busy}><Plus /> Add plan</Button>
        </form>
      )}
    </div>
  );
}

function PlanRow({ plan, canEdit, busy, onSave }: { plan: Plan; canEdit: boolean; busy: boolean; onSave: (body: Record<string, unknown>) => Promise<boolean> }) {
  const [price, setPrice] = useState(String(plan.priceCents / 100));
  const [seats, setSeats] = useState(String(plan.seatsIncluded));
  const dirty = price !== String(plan.priceCents / 100) || seats !== String(plan.seatsIncluded);
  return (
    <tr>
      <td className="px-4 py-3 font-medium capitalize">{plan.name}</td>
      <td className="px-4 py-3 text-right tabular-nums">{canEdit ? <Input aria-label={`${plan.name} price per month`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="ml-auto h-9 w-28 text-right" /> : formatMoney(plan.priceCents)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{canEdit ? <Input aria-label={`${plan.name} seats included`} inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value)} className="ml-auto h-9 w-20 text-right" /> : plan.seatsIncluded}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{plan.active ? "Offered" : "Retired"}</span>
          {canEdit && (<>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onSave({ active: !plan.active })}>{plan.active ? "Retire" : "Offer again"}</Button>
            {dirty && <Button size="sm" disabled={busy} onClick={() => onSave({ price, seatsIncluded: seats })}>Save</Button>}
          </>)}
        </div>
      </td>
    </tr>
  );
}

function FeaturePicker({ plan, blurb, canEdit, busy, onSave }: { plan: Plan; blurb?: string; canEdit: boolean; busy: boolean; onSave: (features: string[]) => Promise<boolean> }) {
  const everything = plan.features == null;
  const saved = plan.features ?? FEATURES.map((f) => f.key as string);
  const [picked, setPicked] = useState<string[]>(saved);
  const dirty = picked.length !== saved.length || picked.some((k) => !saved.includes(k));
  const toggle = (k: string) => setPicked((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5 shadow-panel" aria-label={`${plan.name} features`}>
      <div>
        <h3 className="font-medium capitalize">{plan.name} <span className="text-xs font-normal text-muted-foreground">{everything ? "· everything (no list set)" : `· ${saved.length} of ${FEATURES.length}`}</span></h3>
        {blurb && <p className="text-xs text-muted-foreground">{blurb}</p>}
      </div>
      {(["Modules", "Extras"] as const).map((group) => (
        <fieldset key={group} className="space-y-1.5">
          <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group}</legend>
          {FEATURES.filter((f) => f.group === group).map((f) => (
            <label key={f.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--brand-blue)]" checked={picked.includes(f.key)} disabled={!canEdit} onChange={() => toggle(f.key)} />
              {f.label}
            </label>
          ))}
        </fieldset>
      ))}
      {canEdit && dirty && <Button size="sm" disabled={busy} onClick={() => onSave(picked)}>Save {plan.name}</Button>}
    </section>
  );
}
