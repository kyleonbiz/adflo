"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText } from "lucide-react";
import { Brand } from "@/components/brand";
import { MODULES, moduleHref } from "@/lib/modules/registry";
import { MODULE_ICONS } from "./module-icons";
import { cn } from "@/lib/utils";

interface Item { id: string; label: string; href: string }

/** `/app` is the documents module itself, so it only matches exactly; every other link also matches its sub-pages. */
const isActive = (pathname: string, href: string, base: string) =>
  href === base ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

function NavLink({ item, active, onNavigate }: { item: Item; active: boolean; onNavigate?: () => void }) {
  const Icon = MODULE_ICONS[item.id] ?? FileText;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-sky",
        active ? "bg-brand-blue/20 text-white shadow-[inset_3px_0_0_0_var(--brand-sky)]" : "text-slate-300 hover:bg-white/8 hover:text-white",
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

/** The vertical module menu: Home, the AI assistant and the working modules, then Settings apart at the bottom. */
export function SidebarNav({ base, onNavigate }: { base: "/app"; onNavigate?: () => void }) {
  const pathname = usePathname();
  const modules: Item[] = MODULES.flatMap((m) => {
    const href = moduleHref(m, base);
    return href && m.id !== "setup" && !m.hidden ? [{ id: m.id, label: m.name, href }] : [];
  });
  const setup = MODULES.find((m) => m.id === "setup");
  const setupHref = setup ? moduleHref(setup, base) : null;
  const overview: Item = { id: "overview", label: "Home", href: `${base}/overview` };
  const assistant: Item = { id: "assistant", label: "AI Assistant", href: `${base}/assistant` };

  return (
    <div className="flex h-full flex-col gap-4 bg-brand-navy p-4">
      <Brand wordmark light href={`${base}/overview`} className="w-44 px-1" />
      <nav aria-label="Services" className="flex flex-1 flex-col">
        <ul className="space-y-1">
          {[overview, assistant, ...modules].map((item) => (
            <li key={item.id}><NavLink item={item} active={isActive(pathname, item.href, base)} onNavigate={onNavigate} /></li>
          ))}
        </ul>
        {setup && setupHref && (
          <ul className="mt-auto space-y-1 border-t border-white/10 pt-3">
            <li><NavLink item={{ id: "setup", label: setup.name, href: setupHref }} active={isActive(pathname, setupHref, base)} onNavigate={onNavigate} /></li>
          </ul>
        )}
      </nav>
    </div>
  );
}
