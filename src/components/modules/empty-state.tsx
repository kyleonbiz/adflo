import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";

/**
 * What a module shows before it holds anything: what it is for, three concrete things it does for you,
 * and the first step as a button. Pass the actions as children.
 */
export function EmptyState({ icon: Icon, title, description, points, children }: { icon: LucideIcon; title: string; description: string; points: [string, string, string]; children?: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-2xl border bg-card p-6 shadow-panel sm:p-8" data-testid="empty-state">
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden /></span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> <span>{p}</span></li>
        ))}
      </ul>
      {children && <div className="mt-6 flex flex-wrap gap-2">{children}</div>}
    </section>
  );
}
