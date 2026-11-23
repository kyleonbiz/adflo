import { Skeleton } from "@/components/ui/skeleton";

// Shown in the page area while the next page is prepared. The menu and top bar stay put because they live in the layout.
export default function AppLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading" role="status" data-testid="page-loading">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-40" />
    </div>
  );
}
