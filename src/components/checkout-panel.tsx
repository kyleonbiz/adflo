"use client";

import { useEffect, useState } from "react";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRIAL_DAYS } from "@/lib/billing/trial";
import { SEAT_PRICE_CENTS, TIERS } from "@/lib/control/tiers";

type Interval = "month" | "year";
interface State { subscribed: boolean; status: string | null }

const plan = TIERS[0];
const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US")}`;
const INCLUDED = [
  "Documents, licenses, insurance and vendors",
  "Invoices, projects, forms and signing",
  "Tools, vehicles and equipment records",
  "Addy, your AI assistant (you approve every change)",
  `${plan.seatsIncluded} seats, ${plan.limits.storageGb} GB storage, priority support`,
];

/** The page where a new workspace starts its free trial: pick monthly or yearly, then continue to Stripe's secure checkout. */
export function CheckoutPanel() {
  const [interval, setInterval] = useState<Interval>("month");
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

  async function start() {
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ interval }) });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.data?.url) { window.location.assign(body.data.url as string); return; }
      setMessage(body?.error?.message ?? "Something went wrong. Try again.");
    } catch { setMessage("Could not reach the server. Try again."); }
    setBusy(false);
  }

  const monthly = plan.limits.priceCents ?? 0;
  const annual = plan.limits.annualCents ?? monthly * 10;
  const price = interval === "year" ? annual : monthly;
  const per = interval === "year" ? "year" : "month";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Start your {TRIAL_DAYS}-day free trial</h1>
        <p className="mt-1 text-sm text-muted-foreground">Try everything in {plan.label} free for {TRIAL_DAYS} days. Cancel before it ends and you pay nothing.</p>
      </div>
      <section aria-label="Plan" className="rounded-2xl border bg-card p-6 shadow-panel">
        <div role="radiogroup" aria-label="Billing interval" className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1 text-sm font-medium">
          {([["month", "Monthly"], ["year", "Yearly · 2 months free"]] as const).map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={interval === v} onClick={() => setInterval(v)}
              className={`rounded-lg px-3 py-2 transition ${interval === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
          ))}
        </div>
        <h2 className="mt-5 text-lg font-semibold">{plan.label}</h2>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{usd(price)}<span className="text-base font-normal text-muted-foreground"> / {per}</span></p>
        <p className="mt-1 text-sm text-muted-foreground">Extra seats are {usd(SEAT_PRICE_CENTS)} each per month.</p>
        <ul className="mt-4 space-y-2 text-sm">
          {INCLUDED.map((i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand-purple" aria-hidden="true" />{i}</li>)}
        </ul>
        <dl className="mt-5 space-y-1 border-t pt-4 text-sm">
          <div className="flex justify-between"><dt>Due today</dt><dd className="font-medium">$0</dd></div>
          <div className="flex justify-between text-muted-foreground"><dt>After {TRIAL_DAYS} days</dt><dd>{usd(price)} / {per}</dd></div>
        </dl>
        {state?.subscribed ? (
          <p className="mt-5 text-sm text-muted-foreground">You already have a subscription. Manage it under Help &amp; Training.</p>
        ) : (
          <Button type="button" size="lg" className="mt-5 w-full" disabled={busy} onClick={() => void start()}>
            <Lock aria-hidden="true" /> {busy ? "Opening secure checkout…" : `Start ${TRIAL_DAYS}-day free trial`}
          </Button>
        )}
        {message && <p role="alert" className="mt-3 text-sm text-destructive">{message}</p>}
        <p className="mt-3 text-center text-xs text-muted-foreground">Secure payment by Stripe. Your card is charged when the trial ends, and you can cancel any time.</p>
      </section>
    </div>
  );
}
