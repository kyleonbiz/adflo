"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Brand } from "@/components/brand";
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
      <aside className="hidden border-r bg-card lg:sticky lg:top-0 lg:block lg:h-dvh lg:w-64 lg:shrink-0 lg:overflow-y-auto">
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
                  <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] animate-fade-in overflow-y-auto bg-card shadow-float outline-none lg:hidden">
                    <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
                    <DialogPrimitive.Description className="sr-only">Choose a module</DialogPrimitive.Description>
                    <DialogPrimitive.Close aria-label="Close menu" className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                      <X className="size-4" aria-hidden />
                    </DialogPrimitive.Close>
                    <SidebarNav base={base} onNavigate={() => setOpen(false)} />
                  </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
              </DialogPrimitive.Root>
              <Brand href={`${base}/overview`} className="min-w-0" compact />
            </div>
            <div className="ml-auto flex min-w-0 items-center gap-3">{topRight}</div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-3 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
