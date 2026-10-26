import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/** A headline number. Give it an `href` to link to where the detail lives, or an `onClick` to act on the page (e.g. set a filter). */
export function SummaryTile({ icon: Icon, label, value, tone, href, onClick, pressed }: { icon: LucideIcon; label: string; value: string | number; tone: string; href?: string; onClick?: () => void; pressed?: boolean }) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={`size-4 ${tone}`} aria-hidden /> {label}
      </div>
      <p className="mt-1 break-words text-2xl font-semibold tabular-nums sm:text-3xl">{value}</p>
    </>
  );
  const box = "block rounded-2xl border bg-card p-4 shadow-panel";
  const interactive = `${box} w-full text-left outline-none transition-shadow hover:shadow-float focus-visible:ring-2 focus-visible:ring-ring`;
  if (onClick) return <button type="button" onClick={onClick} aria-pressed={pressed} className={interactive}>{body}</button>;
  if (!href) return <div className={box}>{body}</div>;
  return <Link href={href} className={`${box} outline-none transition-shadow hover:shadow-float focus-visible:ring-2 focus-visible:ring-ring`}>{body}</Link>;
}
