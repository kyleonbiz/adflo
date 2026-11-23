import { ADD_ONS, TIERS, type PlanLimits } from "@/lib/control/tiers";

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const num = (n: number) => n.toLocaleString("en-US");
const tokens = (n: number) => `~${n / 1_000_000}M`;

/** One line per limit, in the order shown everywhere (landing page, app, Control center). */
export function limitRows(t: (typeof TIERS)[number]): { label: string; value: string }[] {
  const l: PlanLimits = t.limits;
  const more = t.name === "enterprise";
  return [
    { label: "Price", value: more ? `From ${money(l.priceCents)}/month, quoted per customer` : `${money(l.priceCents)}/month · ${money(l.annualCents ?? 0)}/year` },
    { label: "Seats", value: more ? `${l.seats} included, more by quote` : `${l.seats} included` },
    { label: "Storage", value: more ? `${l.storageGb} GB+` : `${l.storageGb} GB` },
    { label: "Max file size", value: `${l.maxFileMb} MB` },
    { label: "Quick actions (rules-based assistant)", value: "Unlimited" },
    { label: "Claude actions / month (approval-based)", value: more ? `${num(l.aiActions)}+` : num(l.aiActions) },
    { label: "Token backstop / month", value: l.tokenBackstop ? `${tokens(l.tokenBackstop)} input + output` : "Per contract" },
    { label: "OCR of photos / month", value: more ? `${num(l.ocrPerMonth)}+` : num(l.ocrPerMonth) },
    { label: "Support", value: t.support },
    { label: "Add-ons", value: more ? "Included in the quote" : ADD_ONS.map((a) => `${money(a.priceCents)} per ${a.per}`).join("; ") },
  ];
}

/** The plans side by side, with add-ons. Used in the app's Help page and the Control center. */
export function PlanLimitsTable() {
  const core = TIERS[0].limits;
  const rows = TIERS.map(limitRows);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-3 py-2 font-medium"><span className="sr-only">Limit</span></th>{TIERS.map((t) => <th key={t.name} className="px-3 py-2 font-medium">{t.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            <tr><th scope="row" className="px-3 py-2 font-medium">Audience</th>{TIERS.map((t) => <td key={t.name} className="px-3 py-2 text-muted-foreground">{t.audience}</td>)}</tr>
            {rows[0].map((row, i) => (
              <tr key={row.label}><th scope="row" className="px-3 py-2 font-medium">{row.label}</th>{TIERS.map((t, j) => <td key={t.name} className="px-3 py-2 text-muted-foreground">{rows[j][i].value}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Core + is {money(core.priceCents)}/month with {core.seats} seats included, plus {money(ADD_ONS[0].priceCents)} for each extra seat.
        Claude actions count when Claude proposes a change, approved or not. Quick actions are not limited.
      </p>
    </div>
  );
}
