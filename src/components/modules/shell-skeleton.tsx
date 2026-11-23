import { Skeleton } from "@/components/ui/skeleton";

/**
 * Stands in for the whole app frame (menu, top bar, page) while the shell's lookups finish on a full page load, with the
 * same proportions as AppFrame so nothing jumps when the real frame streams in.
 */
export function ShellSkeleton() {
  return (
    <div className="app-mesh min-h-dvh lg:flex" aria-busy="true" role="status" aria-label="Loading" data-testid="shell-loading">
      <aside className="hidden sidebar-glass lg:block lg:h-dvh lg:w-64 lg:shrink-0">
        <div className="space-y-3 p-4">
          <Skeleton className="h-8 w-28" />
          {Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="h-9" />)}
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="glass-header sticky top-0 z-30">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
            <Skeleton className="hidden h-9 w-72 sm:block" />
            <Skeleton className="ml-auto h-8 w-40" />
          </div>
        </header>
        <main className="mx-auto max-w-6xl space-y-4 px-3 py-6 sm:px-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
          <Skeleton className="h-40" />
        </main>
      </div>
    </div>
  );
}
