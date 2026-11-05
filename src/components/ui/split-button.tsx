"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface MenuAction {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}

/**
 * The usual way to do something is the button; the other ways to do it sit in the small arrow beside it.
 * `menuLabel` names the arrow for screen readers, for example "More ways to add a license".
 */
export function SplitButton({
  children, onClick, menuLabel, actions, variant = "default", disabled,
}: { children: ReactNode; onClick: () => void; menuLabel: string; actions: MenuAction[]; variant?: "default" | "outline"; disabled?: boolean }) {
  return (
    <div className="inline-flex">
      <Button variant={variant} onClick={onClick} disabled={disabled} className="rounded-r-none">{children}</Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} aria-label={menuLabel} className={cn("rounded-l-none px-2", variant === "default" ? "border-l border-primary-foreground/30" : "border-l-0")}>
            <ChevronDown className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((a) => <DropdownMenuItem key={a.label} disabled={a.disabled} onSelect={a.onSelect}>{a.icon}{a.label}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** One "Export" button that opens the choice of formats. */
export function ExportMenu({ actions, disabled, label = "Export" }: { actions: MenuAction[]; disabled?: boolean; label?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>{label} <ChevronDown className="size-4" aria-hidden /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((a) => <DropdownMenuItem key={a.label} disabled={a.disabled} onSelect={a.onSelect}>{a.icon}{a.label}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
