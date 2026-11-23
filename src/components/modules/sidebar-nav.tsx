"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronDown, FileText, type LucideIcon } from "lucide-react";
import { AdFloMark, Brand } from "@/components/brand";
import { MODULES, moduleHref } from "@/lib/modules/registry";
import { AddEntryMenu } from "./add-entry-menu";
import { MODULE_ICONS } from "./module-icons";
import { cn } from "@/lib/utils";
import { itemAllowed } from "@/lib/control/gating";
import { usePlanFeatures } from "@/components/plan-features";

export interface NavItem { id: string; label: string; href: string; icon?: LucideIcon }
type Item = NavItem;

/** `/app` is the documents module itself, so it only matches exactly; every other link also matches its sub-pages. */
export const isActive = (pathname: string, href: string, base: string) =>
  href === base ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

export function NavLink({ item, active, onNavigate, collapsed, badge }: { item: Item; active: boolean; onNavigate?: () => void; collapsed?: boolean; badge?: number }) {
  const Icon = item.icon ?? MODULE_ICONS[item.id] ?? FileText;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? (badge ? `${item.label}, ${badge} new` : item.label) : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        collapsed && "justify-center px-0",
        "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-sky",
        active ? "bg-white/10 text-white shadow-[inset_2px_0_0_0_var(--brand-sky)]" : "text-slate-300 hover:bg-white/8 hover:text-white",
      )}
    >
      <span className="relative inline-flex shrink-0">
        <Icon className="size-[18px]" aria-hidden />
        {collapsed && !!badge && <span aria-hidden className="absolute -right-1 -top-1 size-2 rounded-full bg-amber-400 ring-2 ring-[#0b1030]" />}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && !!badge && <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold leading-5 text-slate-900" aria-label={`${badge} new`}>{badge}</span>}
    </Link>
  );
}

/** Where it helps, a service opens to the parts of it you can jump straight to. Services with one screen have none. */
const SUB_ITEMS: Record<string, { label: string; path: string; query?: string }[]> = {
  crm: [{ label: "People", path: "contacts" }, { label: "Vendors", path: "vendors" }],
  projects: [{ label: "Task List", path: "projects" }, { label: "Projects", path: "projects", query: "view=projects" }],
  reporting: [{ label: "Reports", path: "reporting" }, { label: "Metrics", path: "reporting", query: "section=metrics" }, { label: "Scheduled Reports", path: "reporting", query: "section=scheduled" }, { label: "Materials", path: "reporting", query: "section=materials" }],
};

function NavGroup({ item, base, active, onNavigate, collapsed }: { item: Item; base: string; active: boolean; onNavigate?: () => void; collapsed: boolean }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const subs = SUB_ITEMS[item.id] ?? [];
  const [open, setOpen] = useState(false);
  if (collapsed || subs.length === 0) return <NavLink item={item} active={active} onNavigate={onNavigate} collapsed={collapsed} />;
  const expanded = open || active;
  const isSub = (s: (typeof subs)[number]) => {
    if (pathname !== `${base}/${s.path}`) return false;
    const key = s.query?.split("=")[0];
    if (key) return search.get(key) === s.query!.split("=")[1];
    const others = subs.filter((x) => x.path === s.path && x.query).map((x) => x.query!.split("=")[0]);
    return others.every((k) => !subs.some((x) => x.query?.startsWith(`${k}=`) && search.get(k) === x.query.split("=")[1]));
  };
  return (
    <>
      <div className="relative">
        <NavLink item={item} active={active} onNavigate={onNavigate} />
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Hide" : "Show"} ${item.label} sections`}
          onClick={() => setOpen(!expanded)}
          className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-300 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-brand-sky"
        >
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
      </div>
      {expanded && (
        <ul aria-label={`${item.label} sections`} className="ml-5 space-y-0.5 border-l border-white/10 pl-2">
          {subs.map((s) => (
            <li key={s.label}>
              <Link
                href={`${base}/${s.path}${s.query ? `?${s.query}` : ""}`}
                onClick={onNavigate}
                aria-current={active && isSub(s) ? "location" : undefined}
                className={cn("flex h-8 items-center rounded-lg px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-sky", active && isSub(s) ? "font-medium text-white" : "text-slate-400 hover:bg-white/8 hover:text-white")}
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * How the menu is grouped, top to bottom: home, then where records live, then day-to-day work, then looking back. Anything not
 * listed here (a service added later) lands in a last group, so it is never lost.
 */
const GROUPS: { label: string | null; ids: string[] }[] = [
  { label: null, ids: ["overview", "assistant"] },
  { label: "Records", ids: ["documents", "invoices", "licenses", "equipment", "crm"] },
  { label: "Work", ids: ["projects", "forms", "calendar"] },
  { label: "Insights", ids: ["reporting", "activity"] },
];

/** The vertical module menu: Dashboard, Addy and the working modules in labelled groups, then Settings apart at the bottom. */
export function SidebarNav({ base, onNavigate, collapsed = false }: { base: "/app"; onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  const features = usePlanFeatures();
  const modules: Item[] = MODULES.flatMap((m) => {
    const href = moduleHref(m, base);
    return href && m.id !== "setup" && m.id !== "vendors" && !m.hidden && itemAllowed(features, m.id) ? [{ id: m.id, label: m.name, href }] : [];
  });
  const setup = MODULES.find((m) => m.id === "setup");
  const setupHref = setup ? moduleHref(setup, base) : null;
  const overview: Item = { id: "overview", label: "Dashboard", href: `${base}/overview` };
  const assistant: Item = { id: "assistant", label: "Addy", href: `${base}/assistant` };
  const calendar: Item = { id: "calendar", label: "Calendar", href: `${base}/calendar` };
  const activity: Item = { id: "activity", label: "Activity", href: `${base}/activity` };

  const byId = new Map<string, Item>([overview, assistant, calendar, activity, ...modules].map((m) => [m.id, m]));
  const grouped = new Set(GROUPS.flatMap((g) => g.ids));
  const sections = [...GROUPS, { label: null, ids: [...byId.keys()].filter((id) => !grouped.has(id)) }]
    .map((g) => ({ label: g.label, items: g.ids.map((id) => byId.get(id)).filter((m): m is Item => !!m && itemAllowed(features, m.id)) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className={cn("flex h-full flex-col gap-4 p-4", collapsed && "items-center px-2")}>
      {collapsed ? (
        <Link href={`${base}/overview`} aria-label="AdFlo home" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white outline-none focus-visible:ring-2 focus-visible:ring-brand-sky">
          <AdFloMark className="size-6" />
        </Link>
      ) : (
        <Brand wordmark light href={`${base}/overview`} className="w-44 px-1" />
      )}
      <nav aria-label="Services" className="flex min-h-0 w-full flex-1 flex-col">
        <ul className="-mx-1 min-h-0 overflow-y-auto overflow-x-hidden px-1">
          {sections.map((g, i) => (
            <li key={g.label ?? `group-${i}`} className={cn(i > 0 && (collapsed ? "mt-2 border-t border-white/10 pt-2" : "mt-0.5"))}>
              {g.label && !collapsed && <p id={`nav-group-${g.label}`} className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{g.label}</p>}
              <ul aria-labelledby={g.label && !collapsed ? `nav-group-${g.label}` : undefined} className="space-y-0.5">
                {g.items.map((item) => (
                  <li key={item.id}><NavGroup item={item} base={base} active={isActive(pathname, item.href, base) || (item.id === "crm" && isActive(pathname, `${base}/vendors`, base))} onNavigate={onNavigate} collapsed={collapsed} /></li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <div className="mt-auto space-y-3 border-t border-white/10 pt-3">
          <AddEntryMenu base={base} onNavigate={onNavigate} collapsed={collapsed} />
          {setup && setupHref && (
            <ul className="space-y-1">
              <li><NavLink item={{ id: "setup", label: setup.name, href: setupHref }} active={isActive(pathname, setupHref, base)} onNavigate={onNavigate} collapsed={collapsed} /></li>
            </ul>
          )}
        </div>
      </nav>
    </div>
  );
}
