import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dashboard } from "@/components/modules/dashboard";
import { SetupStatus } from "@/components/setup/setup-status";
import { MODULES, moduleHref } from "@/lib/modules/registry";

/** The signed-in home: a dashboard of what needs attention, then the catalogue of services. */
export function ModuleOverview({ base }: { base: "/app" }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your back office dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Where things stand today, and what needs you next.
        </p>
      </div>
      <SetupStatus base={base} />
      <Dashboard base={base} />
      <h2 className="pt-2 text-lg font-semibold tracking-tight">All services</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => {
          const href = moduleHref(m, base);
          const body = (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">{m.number}</span>
                {href ? <Badge variant="success">Available</Badge> : <Badge variant="muted">Planned</Badge>}
              </div>
              <h3 className="mt-2 text-base font-semibold">{m.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{m.summary}</p>
              {href && (
                <p className="mt-3 flex items-center gap-1 text-sm font-medium text-primary">
                  Open <ArrowRight className="size-4" aria-hidden />
                </p>
              )}
            </>
          );
          return (
            <li key={m.id} data-testid="module-tile">
              {href ? (
                <Link href={href} className="block h-full rounded-2xl border bg-card p-4 shadow-panel outline-none transition-shadow hover:shadow-float focus-visible:ring-2 focus-visible:ring-ring">
                  {body}
                </Link>
              ) : (
                <div className="h-full rounded-2xl border border-dashed bg-card/60 p-4">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
