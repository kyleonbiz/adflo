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

export function NavLink({ item, active, onNavigate, collapsed }: { item: Item; active: boolean; onNavigate?: () => void; collapsed?: boolean }) {
  const Icon = item.icon ?? MODULE_ICONS[item.id] ?? FileText;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        collapsed && "justify-center px-0",
        "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-sky",
        active ? "bg-brand-blue/25 bg-[image:linear-gradient(90deg,rgb(255_255_255/0.15),transparent)] text-white ring-1 ring-white/15 shadow-[inset_3px_0_0_0_var(--brand-sky),0_0_28px_-8px_var(--brand-sky)]" : "text-slate-300 hover:bg-white/8 hover:text-white",
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

/** Where it helps, a service opens to the parts of it you can jump straight to. Services with one screen have none. */
const SUB_ITEMS: Record<string, { label: string; path: string; query?: string }[]> = {
  crm: [{ label: "People", path: "contacts" }, { label: "Vendors", path: "vendors" }],
  projects: [{ label: "Task list", path: "projects" }, { label: "Projects", path: "projects", query: "view=projects" }],
  reporting: [{ label: "Reports", path: "reporting" }, { label: "Scheduled reports", path: "reporting", query: "section=scheduled" }, { label: "Materials", path: "reporting", query: "section=materials" }],
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

/** The vertical module menu: Dashboard, AI Assistant and the working modules, then Settings apart at the bottom. */
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
  const assistant: Item = { id: "assistant", label: "AI Assistant", href: `${base}/assistant` };
  const calendar: Item = { id: "calendar", label: "Calendar", href: `${base}/calendar` };
  const activity: Item = { id: "activity", label: "Activity", href: `${base}/activity` };

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
        <ul className="min-h-0 space-y-1 overflow-y-auto">
          {[overview, assistant, ...modules, calendar, activity].filter((item) => itemAllowed(features, item.id)).map((item) => (
            <li key={item.id}><NavGroup item={item} base={base} active={isActive(pathname, item.href, base) || (item.id === "crm" && isActive(pathname, `${base}/vendors`, base))} onNavigate={onNavigate} collapsed={collapsed} /></li>
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
