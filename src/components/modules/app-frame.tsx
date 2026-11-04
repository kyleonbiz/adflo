"use client";

import { useState } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Brand } from "@/components/brand";
import { GlobalSearch } from "./global-search";
import { saveSidebarCollapsed, useSidebarCollapsed } from "@/lib/sidebar-storage";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./sidebar-nav";
import { ControlNav } from "@/components/control/control-nav";

/**
 * The page frame for every module: a fixed menu down the left on wide screens, and on a phone a menu
 * button that opens the same menu as a drawer. `topRight` holds page-specific items (workspace name,
 * sign out, the demo badge).
 */
export function AppFrame({ base, topRight, children, variant = "app" }: { base: "/app" | "/control"; topRight?: React.ReactNode; children: React.ReactNode; variant?: "app" | "control" }) {
  const control = variant === "control";
  const Nav = control ? ControlNav : SidebarNav;
  const [open, setOpen] = useState(false);
  const collapsed = useSidebarCollapsed();
  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-float focus:outline-none focus:ring-2 focus:ring-ring">Skip to content</a>
      <aside id="sidebar" className={cn("hidden border-r border-white/5 bg-brand-navy transition-[width] duration-200 lg:sticky lg:top-0 lg:block lg:h-dvh lg:shrink-0 lg:overflow-y-auto", collapsed ? "lg:w-[4.5rem]" : "lg:w-64")}>
        <Nav base={base as "/app"} collapsed={collapsed} />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-b bg-card">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2 lg:hidden">
              <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
                <DialogPrimitive.Trigger asChild>
                  <button type="button" aria-label="Open menu" className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                    <Menu className="size-5" aria-hidden />
                  </button>
                </DialogPrimitive.Trigger>
                <DialogPrimitive.Portal>
                  <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-slate-950/30 backdrop-blur-[2px] lg:hidden" />
                  <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] animate-fade-in overflow-y-auto bg-brand-navy shadow-float outline-none lg:hidden">
                    <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
                    <DialogPrimitive.Description className="sr-only">Choose a service</DialogPrimitive.Description>
                    <DialogPrimitive.Close aria-label="Close menu" className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-brand-sky">
                      <X className="size-4" aria-hidden />
                    </DialogPrimitive.Close>
                    <Nav base={base as "/app"} onNavigate={() => setOpen(false)} />
                  </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
              </DialogPrimitive.Root>
              <Brand href={control ? "/control" : `${base}/overview`} className="min-w-0" compact />
            </div>
            <button type="button" onClick={() => saveSidebarCollapsed(!collapsed)} aria-expanded={!collapsed} aria-controls="sidebar" className="hidden h-9 shrink-0 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex">
              {collapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />} {collapsed ? "Expand menu" : "Minimize menu"}
            </button>
            <div className="hidden min-w-0 flex-1 sm:block">{control ? <span className="text-sm font-medium text-muted-foreground">Control Center</span> : <GlobalSearch />}</div>
            <div className="ml-auto flex min-w-0 items-center gap-3">{topRight}</div>
          </div>
          {!control && <div className="px-4 pb-3 sm:hidden"><GlobalSearch /></div>}
        </header>
        <main id="main-content" tabIndex={-1} className="page-rise mx-auto max-w-6xl px-3 py-6 outline-none sm:px-6">{children}</main>
      </div>
    </div>
  );
}
