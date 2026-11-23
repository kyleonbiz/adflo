import { Progress } from "@/components/ui/progress";
import { limitsFor } from "@/lib/control/tiers";
import type { ClientRecord } from "@/lib/control/types";
import type { Usage } from "@/lib/control/usage";

const n = (v: number) => v.toLocaleString("en-US");

/** One metered line: used of limit with a bar, turning amber at 80% and red at the limit. */
function Meter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = limit && used >= limit ? "bg-red-500" : limit && pct >= 80 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{n(used)}{limit ? ` of ${n(limit)}` : ""}</span>
      </div>
      {limit ? <Progress value={pct} aria-label={`${label}: ${pct}% used`} indicatorClassName={tone} className="h-2" /> : null}
    </div>
  );
}

/** This month's usage on a client's profile, against the limits of their plan. */
export function ClientUsage({ client }: { client: ClientRecord }) {
  const limits = limitsFor(client.plan);
  const u: Usage | null = client.usage ?? null;
  return (
    <section id="usage" className="scroll-mt-4 rounded-2xl border bg-card p-5 shadow-panel" aria-label="Usage this month">
      <h2 className="font-semibold">Usage this month</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {limits ? `Against the ${client.plan} limits. ` : "This plan has no usage limits. "}Counts reset on the 1st (UTC).
      </p>
      {!u ? (
        <p className="mt-3 text-sm text-muted-foreground">No usage to show: this client has no workspace yet, or usage cannot be read.</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Meter label="Claude actions" used={u.aiActions} limit={limits?.aiActions ?? null} />
          <Meter label="Photo reads (OCR)" used={u.ocrReads} limit={limits?.ocrPerMonth ?? null} />
          <Meter label="Claude tokens" used={u.tokens} limit={limits?.tokenBackstop ?? null} />
          <Meter label="Quick actions (never limited)" used={u.quickActions} limit={null} />
        </div>
      )}
    </section>
  );
}
