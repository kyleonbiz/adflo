"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Brand } from "@/components/brand";
import { GlobalSearch } from "./global-search";
import { SidebarNav } from "./sidebar-nav";

/**
 * The page frame for every module: a fixed menu down the left on wide screens, and on a phone a menu
 * button that opens the same menu as a drawer. `topRight` holds page-specific items (workspace name,
 * sign out, the demo badge).
 */
export function AppFrame({ base, topRight, children }: { base: "/app"; topRight?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-float focus:outline-none focus:ring-2 focus:ring-ring">Skip to content</a>
      <aside className="hidden border-r border-white/5 bg-brand-navy lg:sticky lg:top-0 lg:block lg:h-dvh lg:w-64 lg:shrink-0 lg:overflow-y-auto">
        <SidebarNav base={base} />
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
                    <SidebarNav base={base} onNavigate={() => setOpen(false)} />
                  </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
              </DialogPrimitive.Root>
              <Brand href={`${base}/overview`} className="min-w-0" compact />
            </div>
            <div className="hidden min-w-0 flex-1 sm:block"><GlobalSearch /></div>
            <div className="ml-auto flex min-w-0 items-center gap-3">{topRight}</div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-3 py-6 outline-none sm:px-6">{children}</main>
      </div>
    </div>
  );
}
