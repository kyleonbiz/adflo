"use client";

import { cn } from "@/lib/utils";

/** An on/off switch, styled like the ones in Settings. Give it a label with `aria-label` or `aria-labelledby`. */
export function Switch({ checked, onCheckedChange, disabled, className, ...aria }: { checked: boolean; onCheckedChange: (on: boolean) => void; disabled?: boolean; className?: string; id?: string; "aria-label"?: string; "aria-labelledby"?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", checked ? "bg-primary" : "bg-input", className)}
      {...aria}
    >
      <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
    </button>
  );
}
