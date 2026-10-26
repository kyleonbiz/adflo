import type { ReportRow } from "@/lib/reporting/logic";

/** A labelled bar per row, longest first as given. The label sits above the bar on a phone. */
export function ReportBars({ rows, label }: { rows: ReportRow[]; label: string }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2" aria-label={label}>
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,9rem)_1fr_auto]" data-testid="breakdown-row">
          <span className="order-1 truncate font-medium" title={r.label}>{r.label}</span>
          <span className="order-3 col-span-2 h-2.5 rounded-full bg-secondary sm:order-2 sm:col-span-1" aria-hidden>
            <span className="block h-full rounded-full bg-gradient-to-r from-blue-500 to-brand-violet" style={{ width: `${max > 0 ? Math.max(2, (r.value / max) * 100) : 0}%` }} />
          </span>
          <span className="order-2 text-right tabular-nums sm:order-3">{r.display ?? r.value}</span>
        </li>
      ))}
    </ul>
  );
}
