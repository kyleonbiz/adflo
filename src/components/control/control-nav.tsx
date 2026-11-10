"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Building2, FileSignature, Home, LifeBuoy, Receipt, ScrollText, Tag, UsersRound } from "lucide-react";
import { AdFloMark, Brand } from "@/components/brand";
import { NavLink, isActive, type NavItem } from "@/components/modules/sidebar-nav";
import { cn } from "@/lib/utils";

/** What the Control Center offers so far. Each step of the build adds its screen here. */
const ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", href: "/control", icon: Home },
  { id: "clients", label: "Clients", href: "/control/clients", icon: Building2 },
  { id: "support", label: "Support", href: "/control/support", icon: LifeBuoy },
  { id: "agreements", label: "Agreements", href: "/control/agreements", icon: FileSignature },
  { id: "billing", label: "Billing", href: "/control/billing", icon: Receipt },
  { id: "plans", label: "Plans & pricing", href: "/control/plans", icon: Tag },
  { id: "team", label: "Team", href: "/control/team", icon: UsersRound },
  { id: "monitoring", label: "Monitoring", href: "/control/monitoring", icon: Activity },
  { id: "audit", label: "Audit log", href: "/control/audit", icon: ScrollText },
];

/** Same navy sidebar as the app, with the staff menu. */
export function ControlNav({ onNavigate, collapsed = false }: { base?: "/app"; onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  return (
    <div className={cn("flex h-full flex-col gap-4 p-4", collapsed && "items-center px-2")}>
      {collapsed ? (
        <Link href="/control" aria-label="Control Center home" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white outline-none focus-visible:ring-2 focus-visible:ring-brand-sky">
          <AdFloMark className="size-6" />
        </Link>
      ) : (
        <div className="space-y-2">
          <Brand wordmark light href="/control" className="w-44 px-1" />
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-brand-sky">Control Center</p>
        </div>
      )}
      <nav aria-label="Control Center" className="flex w-full flex-1 flex-col">
        <ul className="space-y-1">
          {ITEMS.map((item) => (
            <li key={item.id}>
              <NavLink item={item} active={item.href === "/control" ? pathname === "/control" : isActive(pathname, item.href, "/control")} onNavigate={onNavigate} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
