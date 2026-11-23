"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BILLING_LABEL } from "@/lib/billing/sync";

interface State { plan: string; status: string | null; interval: string | null; periodEnd: string | null; cancelAtPeriodEnd: boolean; subscribed: boolean }

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "");

/** Subscribe to AdFlo or manage the subscription. Shown only when online billing is set up for this account; the server checks who may use it. */
export function BillingPanel() {
  const [state, setState] = useState<State | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/billing").then(async (res) => {
      const body = await res.json().catch(() => null);
      if (live && res.ok && body?.ok) setState(body.data as State);
    }).catch(() => {});
    return () => { live = false; };
  }, []);

  async function go(url: string, payload?: unknown) {
    setBusy(true); setMessage("");
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload ?? {}) });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.data?.url) { window.location.assign(body.data.url as string); return; }
      setMessage(body?.error?.message ?? "Something went wrong. Try again.");
    } catch { setMessage("Could not reach the server. Try again."); }
    setBusy(false);
  }

  if (!state) return null;
  return (
    <section aria-label="Billing" className="rounded-2xl border bg-card p-6 shadow-panel">
      <h2 className="text-base font-semibold">Billing</h2>
      {state.subscribed ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="billing-status">
            {BILLING_LABEL[state.status ?? ""] ?? state.status ?? "Active"}{state.interval ? ` · billed ${state.interval === "year" ? "yearly" : "monthly"}` : ""}
            {state.periodEnd ? (state.cancelAtPeriodEnd ? ` · ends ${day(state.periodEnd)}` : ` · renews ${day(state.periodEnd)}`) : ""}
          </p>
          <div className="mt-3"><Button type="button" size="sm" disabled={busy} onClick={() => void go("/api/billing/portal")}>Manage billing</Button></div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">Subscribe to AdFlo to pay online by card. You can change or cancel any time from Manage billing.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void go("/api/billing/checkout", { interval: "month" })}>Subscribe monthly</Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void go("/api/billing/checkout", { interval: "year" })}>Subscribe yearly</Button>
          </div>
        </>
      )}
      {message && <p role="alert" className="mt-2 text-sm text-destructive">{message}</p>}
    </section>
  );
}
