"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, type LucideIcon } from "lucide-react";
import { AdFloMark, Brand } from "@/components/brand";
import { MODULES, moduleHref } from "@/lib/modules/registry";
import { AddEntryMenu } from "./add-entry-menu";
import { MODULE_ICONS } from "./module-icons";
import { cn } from "@/lib/utils";

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
        active ? "bg-brand-blue/20 text-white shadow-[inset_3px_0_0_0_var(--brand-sky)]" : "text-slate-300 hover:bg-white/8 hover:text-white",
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

/** The vertical module menu: Home, Addy (the assistant) and the working modules, then Settings apart at the bottom. */
export function SidebarNav({ base, onNavigate, collapsed = false }: { base: "/app"; onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  const modules: Item[] = MODULES.flatMap((m) => {
    const href = moduleHref(m, base);
    return href && m.id !== "setup" && m.id !== "vendors" && !m.hidden ? [{ id: m.id, label: m.name, href }] : [];
  });
  const setup = MODULES.find((m) => m.id === "setup");
  const setupHref = setup ? moduleHref(setup, base) : null;
  const overview: Item = { id: "overview", label: "Home", href: `${base}/overview` };
  const assistant: Item = { id: "assistant", label: "Addy", href: `${base}/assistant` };
  const activity: Item = { id: "activity", label: "Activity", href: `${base}/activity` };

  return (
    <div className={cn("flex h-full flex-col gap-4 bg-brand-navy p-4", collapsed && "items-center px-2")}>
      {collapsed ? (
        <Link href={`${base}/overview`} aria-label="AdFlo home" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white outline-none focus-visible:ring-2 focus-visible:ring-brand-sky">
          <AdFloMark className="size-6" />
        </Link>
      ) : (
        <Brand wordmark light href={`${base}/overview`} className="w-44 px-1" />
      )}
      <nav aria-label="Services" className="flex w-full flex-1 flex-col">
        <ul className="space-y-1">
          {[overview, assistant, ...modules, activity].map((item) => (
            <li key={item.id}><NavLink item={item} active={isActive(pathname, item.href, base) || (item.id === "crm" && isActive(pathname, `${base}/vendors`, base))} onNavigate={onNavigate} collapsed={collapsed} /></li>
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
