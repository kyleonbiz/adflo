import type { LucideIcon } from "lucide-react";

export function SummaryTile({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-panel">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={`size-4 ${tone}`} aria-hidden /> {label}
      </div>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
