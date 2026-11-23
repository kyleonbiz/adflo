import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** The coloured icon used on cards across the app, so icons look alike in every service. */
export function IconSquare({ icon: Icon, className, size = "md" }: { icon: LucideIcon; className?: string; size?: "sm" | "md" }) {
  return (
    <span className={cn("grid shrink-0 place-items-center text-primary", size === "sm" ? "size-9" : "size-10", className)}>
      <Icon className={size === "sm" ? "size-[18px]" : "size-5"} aria-hidden />
    </span>
  );
}
