import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        // The tinted variants carry a small coloured dot (like the dashboard's status line) so a state reads the same in every service.
        default: "bg-accent text-accent-foreground before:size-1.5 before:shrink-0 before:rounded-full before:bg-brand-blue",
        muted: "bg-muted text-muted-foreground",
        outline: "border border-border text-muted-foreground",
        success: "bg-emerald-50 text-emerald-700 before:size-1.5 before:shrink-0 before:rounded-full before:bg-emerald-500",
        warning: "bg-amber-50 text-amber-800 before:size-1.5 before:shrink-0 before:rounded-full before:bg-amber-400",
        danger: "bg-red-50 text-red-700 before:size-1.5 before:shrink-0 before:rounded-full before:bg-red-500",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
