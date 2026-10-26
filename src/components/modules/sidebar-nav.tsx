"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, ClipboardList, FileText, FolderKanban, FolderTree, Home, Inbox, Receipt, Settings, ShieldCheck, Store, Users,
  type LucideIcon,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { MODULES, moduleHref } from "@/lib/modules/registry";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  overview: Home, documents: FileText, invoices: Receipt, licenses: ShieldCheck, vendors: Store, crm: Users,
  projects: FolderKanban, forms: ClipboardList, reporting: BarChart3, admin: Inbox, "file-reset": FolderTree, setup: Settings,
};

interface Item { id: string; label: string; href: string }

/** `/app` is the documents module itself, so it only matches exactly; every other link also matches its sub-pages. */
const isActive = (pathname: string, href: string, base: string) =>
  href === base ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

function NavLink({ item, active, onNavigate }: { item: Item; active: boolean; onNavigate?: () => void }) {
  const Icon = ICONS[item.id] ?? FileText;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

/** The vertical module menu: the overview and the working modules, then Back Office Setup apart at the bottom. */
export function SidebarNav({ base, onNavigate }: { base: "/app" | "/demo"; onNavigate?: () => void }) {
  const pathname = usePathname();
  const modules: Item[] = MODULES.flatMap((m) => {
    const href = moduleHref(m, base);
    return href && m.id !== "setup" ? [{ id: m.id, label: m.name, href }] : [];
  });
  const setup = MODULES.find((m) => m.id === "setup");
  const setupHref = setup ? moduleHref(setup, base) : null;
  const overview: Item = { id: "overview", label: "Home", href: `${base}/overview` };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Brand href={`${base}/overview`} />
      <nav aria-label="Modules" className="flex flex-1 flex-col">
        <ul className="space-y-1">
          {[overview, ...modules].map((item) => (
            <li key={item.id}><NavLink item={item} active={isActive(pathname, item.href, base)} onNavigate={onNavigate} /></li>
          ))}
        </ul>
        {setup && setupHref && (
          <ul className="mt-auto space-y-1 border-t pt-3">
            <li><NavLink item={{ id: "setup", label: setup.name, href: setupHref }} active={isActive(pathname, setupHref, base)} onNavigate={onNavigate} /></li>
          </ul>
        )}
      </nav>
    </div>
  );
}
