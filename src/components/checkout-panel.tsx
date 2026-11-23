"use client";

import { useState } from "react";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEAT_PRICE_CENTS, TIERS } from "@/lib/control/tiers";

type Interval = "month" | "year";

const plan = TIERS[0];
const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US")}`;
const INCLUDED = [
  "Documents, licenses, insurance and vendors",
  "Invoices, projects, forms and signing",
  "Tools, vehicles and equipment records",
  "Addy, your AI assistant (you approve every change)",
  `${plan.limits.storageGb} GB storage and priority support`,
];

/** Pay to continue after the free trial: pick monthly or yearly, then go to Stripe's secure checkout. Payment sets up the workspace. */
export function CheckoutPanel({ expired }: { expired: boolean }) {
  const [interval, setInterval] = useState<Interval>("month");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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

  const price = interval === "year" ? plan.limits.annualCents : plan.limits.priceCents;
  const per = interval === "year" ? "year" : "month";

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {expired ? "Your free trial has ended and your account is paused. Nothing was deleted." : "Keep going with AdFlo any time."} Subscribe and we set up your own workspace right away.
      </p>
      <div role="radiogroup" aria-label="Billing interval" className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1 text-sm font-medium">
        {([["month", "Monthly"], ["year", "Yearly · 2 months free"]] as const).map(([v, label]) => (
          <button key={v} type="button" role="radio" aria-checked={interval === v} onClick={() => setInterval(v)}
            className={`rounded-lg px-3 py-2 transition ${interval === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
        ))}
      </div>
      <div>
        <p className="text-3xl font-semibold tracking-tight">{usd(price)}<span className="text-base font-normal text-muted-foreground"> / {per}</span></p>
        <p className="mt-1 text-sm text-muted-foreground">Includes your seat. Extra seats are {usd(SEAT_PRICE_CENTS)} each per month. No setup fee.</p>
      </div>
      <ul className="space-y-2 text-sm">
        {INCLUDED.map((i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand-purple" aria-hidden="true" />{i}</li>)}
      </ul>
      <Button type="button" size="lg" className="w-full" disabled={busy} onClick={() => void start()}>
        <Lock aria-hidden="true" /> {busy ? "Opening secure checkout…" : `Subscribe for ${usd(price)} / ${per}`}
      </Button>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <p className="text-center text-xs text-muted-foreground">Secure payment by Stripe. Cancel any time.</p>
    </div>
  );
}
