"use client";

import Link from "next/link";
import { Inbox, Plus, Receipt, Upload } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** The sidebar's "Add new entry" button: one menu for starting the things people create most. */
export function AddEntryMenu({ base, onNavigate }: { base: "/app"; onNavigate?: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-sky text-sm font-medium text-white shadow-sm outline-none transition-colors hover:bg-brand-sky/90 focus-visible:ring-2 focus-visible:ring-white/70 data-[state=open]:bg-brand-sky/90">
          <Plus className="size-4" aria-hidden /> Add new entry
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center" className="w-56">
        <DropdownMenuItem asChild><Link href={`${base}/invoices?new=1`} onClick={onNavigate}><Receipt /> New invoice</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href={`${base}?upload=1`} onClick={onNavigate}><Upload /> Upload document</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href={`${base}/admin?new=1`} onClick={onNavigate}><Inbox /> New request</Link></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
