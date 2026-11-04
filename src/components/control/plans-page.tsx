"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, type Plan } from "@/lib/control/types";

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
