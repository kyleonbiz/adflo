"use client";

import Link from "next/link";
import { canOpenSettingsTab, useViewAs } from "@/lib/roles";
import { cn } from "@/lib/utils";

/** The row of settings tabs, without the ones the role being viewed may not open. */
export function SettingsNav({ tabs, current, base }: { tabs: readonly { id: string; label: string }[]; current: string; base: "/app" }) {
  const role = useViewAs();
  return (
    <nav aria-label="Settings sections">
      <ul className="flex flex-wrap gap-2">
        {tabs.filter((t) => canOpenSettingsTab(role, t.id)).map((t) => (
          <li key={t.id}>
            <Link
              href={`${base}/setup?tab=${t.id}`}
              aria-current={t.id === current ? "page" : undefined}
              className={cn("flex h-9 items-center rounded-full border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                t.id === current ? "border-primary bg-accent font-medium text-primary" : "bg-card text-muted-foreground hover:text-foreground")}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Shows a settings tab's content only when the role being viewed may open it. */
export function SettingsTabGate({ tab, children }: { tab: string; children: React.ReactNode }) {
  const role = useViewAs();
  if (canOpenSettingsTab(role, tab)) return <>{children}</>;
  return <p role="status" className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground shadow-panel">Only an Owner can open this section.</p>;
}
