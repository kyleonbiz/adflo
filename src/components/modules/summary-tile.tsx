import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/** A headline number. Give it an `href` to make the whole tile a link to where the detail lives. */
export function SummaryTile({ icon: Icon, label, value, tone, href }: { icon: LucideIcon; label: string; value: string | number; tone: string; href?: string }) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={`size-4 ${tone}`} aria-hidden /> {label}
      </div>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </>
  );
  const box = "block rounded-2xl border bg-card p-4 shadow-panel";
  if (!href) return <div className={box}>{body}</div>;
  return <Link href={href} className={`${box} outline-none transition-shadow hover:shadow-float focus-visible:ring-2 focus-visible:ring-ring`}>{body}</Link>;
}
