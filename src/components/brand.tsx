import Link from "next/link";
import { cn } from "@/lib/utils";

/** The AdFlo logo mark (public/logo-mark.png). */
export function AdFloMark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo-mark.png" alt="" aria-hidden="true" className={cn("object-contain", className)} />;
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
