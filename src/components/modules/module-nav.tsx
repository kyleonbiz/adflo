import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { MODULES, moduleHref } from "@/lib/modules/registry";
import { cn } from "@/lib/utils";

/** Tab bar across the modules that exist today. `active` is a module id or "overview". */
export function ModuleNav({ base, active }: { base: "/app" | "/demo"; active: string }) {
  const tabs = [
    { id: "overview", label: "Overview", href: `${base}/overview`, icon: true },
    ...MODULES.flatMap((m) => {
      const href = moduleHref(m, base);
      return href ? [{ id: m.id, label: m.name, href, icon: false }] : [];
    }),
  ];
  return (
    <nav aria-label="Modules" className="border-b bg-card/80">
      <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 sm:px-6">
        {tabs.map((t) => (
          <li key={t.id} className="shrink-0">
            <Link
              href={t.href}
              aria-current={t.id === active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-1.5 border-b-2 px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                t.id === active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.icon && <LayoutGrid className="size-4" aria-hidden />}
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
