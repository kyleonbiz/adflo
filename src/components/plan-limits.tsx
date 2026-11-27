import { ADD_ONS, ONBOARDING_MAX_CENTS, ONBOARDING_MIN_CENTS, TIERS, type PlanLimits } from "@/lib/control/tiers";
import { TRIAL_DAYS } from "@/lib/billing/trial";

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const num = (n: number) => n.toLocaleString("en-US");
const tokens = (n: number) => `~${n / 1_000_000}M`;

/** One line per limit, in the order shown everywhere (landing page, app, Control center). */
export function limitRows(t: (typeof TIERS)[number]): { label: string; value: string }[] {
  const l: PlanLimits = t.limits;
  return [
    { label: "Price", value: `${money(l.priceCents)}/month with your seat, plus ${money(l.seatCents)}/month per extra seat` },
    { label: "Annual", value: `${money(l.annualCents)}/year plus ${money(l.seatAnnualCents)}/year per extra seat (two months free)` },
    { label: "Onboarding help (optional, one time)", value: `${money(ONBOARDING_MIN_CENTS)} to ${money(ONBOARDING_MAX_CENTS)}, only if you want us to load your records` },
    { label: "Seats", value: `${l.seats} included, more at ${money(l.seatCents)}/month each` },
    { label: "Storage", value: `${l.storageGb} GB` },
    { label: "Max file size", value: `${l.maxFileMb} MB` },
    { label: "Quick actions (rules-based assistant)", value: "Unlimited" },
    { label: "Claude actions / month (approval-based)", value: num(l.aiActions) },
    { label: "Token backstop / month", value: l.tokenBackstop ? `${tokens(l.tokenBackstop)} input + output` : "Per contract" },
    { label: "OCR of photos / month", value: num(l.ocrPerMonth) },
    { label: "Support", value: t.support },
    { label: "Add-ons", value: ADD_ONS.map((a) => `${money(a.priceCents)} per ${a.per}`).join("; ") },
  ];
}

/** The plan and its limits. Used in the app's Help page and the Control center. */
export function PlanLimitsTable() {
  const t = TIERS[0];
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[24rem] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-3 py-2 font-medium"><span className="sr-only">Limit</span></th><th className="px-3 py-2 font-medium">{t.label}</th></tr>
          </thead>
          <tbody className="divide-y">
            <tr><th scope="row" className="px-3 py-2 font-medium">Audience</th><td className="px-3 py-2 text-muted-foreground">{t.audience}</td></tr>
            {limitRows(t).map((row) => (
              <tr key={row.label}><th scope="row" className="px-3 py-2 font-medium">{row.label}</th><td className="px-3 py-2 text-muted-foreground">{row.value}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        One plan, {TRIAL_DAYS}-day trial. Larger or unusual needs get a custom package, quoted per customer. Claude actions count when Claude proposes a change, approved or not. Quick actions are not limited.
      </p>
    </div>
  );
}
