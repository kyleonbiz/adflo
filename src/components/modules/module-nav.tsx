import { LayoutGrid } from "lucide-react";
import { MODULES, moduleHref } from "@/lib/modules/registry";
import { ModuleNavLink } from "./module-nav-link";

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
      {/* Scrolls sideways on narrow screens; wraps onto a second row where there is room. */}
      <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 sm:px-6 lg:flex-wrap lg:overflow-visible">
        {tabs.map((t) => (
          <li key={t.id} className="shrink-0">
            <ModuleNavLink href={t.href} active={t.id === active}>
              {t.icon && <LayoutGrid className="size-4" aria-hidden />}
              {t.label}
            </ModuleNavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
