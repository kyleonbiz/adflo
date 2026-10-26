import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * A headline number. Give it an `href` to make the whole tile a link to where the detail lives, or an
 * `onSelect` to make it a toggle button (e.g. a list filter); `selected` shows whether it is on.
 */
export function SummaryTile({ icon: Icon, label, value, tone, href, onSelect, selected }: {
  icon: LucideIcon; label: string; value: string | number; tone: string; href?: string; onSelect?: () => void; selected?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={`size-4 ${tone}`} aria-hidden /> {label}
      </div>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </>
  );
  const box = "block rounded-2xl border bg-card p-4 shadow-panel";
  if (onSelect) {
    return (
      <button type="button" aria-pressed={!!selected} onClick={onSelect} className={`${box} w-full text-left outline-none transition-shadow hover:shadow-float focus-visible:ring-2 focus-visible:ring-ring ${selected ? "ring-2 ring-primary" : ""}`}>
        {body}
      </button>
    );
  }
  if (!href) return <div className={box}>{body}</div>;
  return <Link href={href} className={`${box} outline-none transition-shadow hover:shadow-float focus-visible:ring-2 focus-visible:ring-ring`}>{body}</Link>;
}
