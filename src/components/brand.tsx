import Link from "next/link";
import { cn } from "@/lib/utils";

/** The AdFlo logo mark (public/logo-mark.png). */
export function AdFloMark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo-mark.png" alt="" aria-hidden="true" className={cn("object-contain", className)} />;
}

/** `compact` shows only the logo mark on a phone, where the top bar is tight; the name returns from `sm` up. */
export function Brand({ className, href = "/", light, compact, wordmark }: { className?: string; href?: string; light?: boolean; compact?: boolean; wordmark?: boolean }) {
  if (wordmark) {
    // The full logo has white lettering, so it sits on its own dark navy panel (matches the logo artwork).
    return (
      <Link href={href} aria-label="AdFlo home" className={cn("block rounded-xl bg-[#050a1d] px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-wordmark.png" alt="AdFlo" width={1015} height={325} className="h-auto w-full" />
      </Link>
    );
  }
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5">
        <AdFloMark className="size-6" />
      </span>
      <span className={cn("block text-lg font-semibold leading-tight tracking-tight", light && "text-white", compact && "hidden sm:block")}>AdFlo</span>
    </Link>
  );
}
