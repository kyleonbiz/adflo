import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const profileLink = "rounded underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 py-2 text-sm text-muted-foreground ${profileLink}`}>
      <ArrowLeft className="size-4" aria-hidden /> {children}
    </Link>
  );
}

export function Section({ title, count, children, testId }: { title: string; count?: number; children: React.ReactNode; testId?: string }) {
  return (
    <section data-testid={testId} className="rounded-2xl border bg-card p-4 shadow-panel">
      <h2 className="text-sm font-semibold">{title}{count !== undefined && <span className="ml-1.5 font-normal text-muted-foreground">{count}</span>}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Facts({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{i.label}</dt>
          <dd className="break-words">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export const None = ({ children = "None yet." }: { children?: React.ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>;

export function ProfileSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-24" />
      <Skeleton className="h-40" />
    </div>
  );
}

export function NotFoundProfile({ what, backHref, backLabel }: { what: string; backHref: string; backLabel: string }) {
  return (
    <div className="space-y-4">
      <BackLink href={backHref}>{backLabel}</BackLink>
      <div className="rounded-2xl border border-dashed bg-card/60 p-10 text-center">
        <h1 className="text-lg font-semibold">We could not find that {what}</h1>
        <p className="mt-1 text-sm text-muted-foreground">It may have been deleted or merged into another record.</p>
      </div>
    </div>
  );
}
