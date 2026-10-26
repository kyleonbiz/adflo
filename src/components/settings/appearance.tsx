"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { setTheme, useTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Day", icon: Sun },
  { id: "dark", label: "Night", icon: Moon },
  { id: "system", label: "Match my device", icon: Monitor },
];

/** Day / Night view switch, saved in this browser. */
export function Appearance() {
  const theme = useTheme();
  return (
    <section aria-label="Appearance" className="space-y-3 rounded-2xl border bg-card p-5 shadow-panel">
      <div role="radiogroup" aria-label="View" className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={theme === id}
            onClick={() => setTheme(id)}
            className={cn("flex h-11 items-center justify-center gap-2 rounded-lg border text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
              theme === id ? "border-primary bg-accent font-medium text-primary" : "bg-card text-muted-foreground hover:text-foreground")}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>
    </section>
  );
}
