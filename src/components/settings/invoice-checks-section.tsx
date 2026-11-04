"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveSettings, useSettings } from "@/lib/settings/storage";
import { VARIANCE_OPTIONS, type InvoiceChecks } from "@/lib/settings/types";
import { cn } from "@/lib/utils";

const CHECKS: { key: "duplicates" | "unusualAmount"; label: string; detail: string }[] = [
  { key: "duplicates", label: "Duplicate check", detail: "Warn when a client already has an invoice for the same total issued within 3 days." },
  { key: "unusualAmount", label: "Unusual amount", detail: "Warn when a total is far from the client's average over their recent invoices (needs at least 3)." },
];

export function InvoiceChecksSection() {
  const settings = useSettings();
  const checks = settings.invoiceChecks;
  const update = (n: Partial<InvoiceChecks>) => saveSettings({ ...settings, invoiceChecks: { ...checks, ...n } });

  return (
    <section aria-label="Invoice checks" className="space-y-4 rounded-2xl border bg-card p-5 shadow-panel">
      <ul className="divide-y">
        {CHECKS.map((c) => (
          <li key={c.key} className="flex items-center justify-between gap-4 py-3 first:pt-0">
            <div>
              <p id={`ic-${c.key}`} className="text-sm font-medium">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.detail}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={checks[c.key]}
              aria-labelledby={`ic-${c.key}`}
              onClick={() => update({ [c.key]: !checks[c.key] })}
              className={cn("relative h-6 w-11 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", checks[c.key] ? "bg-primary" : "bg-input")}
            >
              <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", checks[c.key] && "translate-x-5")} />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="variance">Unusual means more than</Label>
        <Select value={String(checks.variancePct)} onValueChange={(v) => update({ variancePct: Number(v) as InvoiceChecks["variancePct"] })} disabled={!checks.unusualAmount}>
          <SelectTrigger id="variance" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{VARIANCE_OPTIONS.map((p) => <SelectItem key={p} value={String(p)}>{p}% from average</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        Warnings appear when you save an invoice. You can always choose Save anyway. Your choices are saved in this browser.
      </p>
    </section>
  );
}
