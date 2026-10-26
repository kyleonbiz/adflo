import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The AdFlo mark: a bold "A" with a dot. A stand-in drawn in code until the final logo file is supplied;
 * swap this one component and the name below and every page follows.
 */
export function AdFloMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("text-blue-600", className)}>
      <path
        fill="currentColor"
        d="M16 3.5c-1.6 0-3 .9-3.7 2.3L4.6 22.6c-.9 2 .5 4.4 2.8 4.4h.6c1.1 0 2.1-.6 2.6-1.6L16 13.2l5.4 12.2c.5 1 1.5 1.6 2.6 1.6h.6c2.3 0 3.7-2.4 2.8-4.4L19.7 5.8C19 4.4 17.6 3.5 16 3.5Z"
      />
      <circle cx="16" cy="21.5" r="2.6" fill="white" />
    </svg>
  );
}

/** `compact` shows only the logo mark on a phone, where the top bar is tight; the name returns from `sm` up. */
export function Brand({ className, href = "/", light, compact }: { className?: string; href?: string; light?: boolean; compact?: boolean }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5">
        <AdFloMark className="size-6" />
      </span>
      <span className={cn("block text-lg font-semibold leading-tight tracking-tight", light && "text-white", compact && "hidden sm:block")}>AdFlo</span>
    </Link>
  );
}
