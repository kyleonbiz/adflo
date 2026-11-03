import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The coloured square behind a card's icon. The `tone` modules already pass (`text-primary`, `text-sky-600`,
 * `text-amber-600`, `text-red-600`, `text-emerald-600`) picks the colour, so every service shows the same
 * colour for the same meaning as the dashboard: blue for totals, cyan for info, amber for waiting, red for late, green for good.
 */
const SQUARE: Record<string, string> = {
  "text-primary": "bg-brand-blue",
  "text-sky-600": "bg-cyan-400",
  "text-amber-600": "bg-amber-400",
  "text-red-600": "bg-red-500",
  "text-emerald-600": "bg-emerald-500",
};

/** A headline number in the dashboard's card style. Give it an `href` to link to where the detail lives, or an `onClick` to act on the page (e.g. set a filter). */
export function SummaryTile({ icon: Icon, label, value, tone, href, onClick, pressed }: { icon: LucideIcon; label: string; value: string | number; tone: string; href?: string; onClick?: () => void; pressed?: boolean }) {
  const body = (
    <div className="flex h-full min-h-28 flex-col justify-between gap-3">
      {/* The label comes first in the markup (so it leads the accessible name) and is shown under the number. */}
      <div className="flex min-w-0 flex-col-reverse">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="break-words text-2xl font-semibold tabular-nums sm:text-3xl">{value}</p>
      </div>
      <span className={cn("ml-auto grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-sm", SQUARE[tone] ?? "bg-brand-blue")}>
        <Icon className="size-5" aria-hidden />
      </span>
    </div>
  );
  const box = "block rounded-2xl border bg-card p-4 shadow-panel";
  const interactive = cn(box, "w-full text-left outline-none transition-shadow hover:shadow-float focus-visible:ring-2 focus-visible:ring-ring", pressed && "ring-2 ring-primary");
  if (onClick) return <button type="button" onClick={onClick} aria-pressed={pressed} className={interactive}>{body}</button>;
  if (!href) return <div className={box}>{body}</div>;
  return <Link href={href} className={cn(box, "outline-none transition-shadow hover:shadow-float focus-visible:ring-2 focus-visible:ring-ring")}>{body}</Link>;
}
