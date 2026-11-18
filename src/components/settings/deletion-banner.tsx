import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { formatDayLong } from "@/lib/dates";
import { deletionDate, deletionDaysLeft } from "@/lib/dms/deletion";

/** Shown on every signed-in page while a workspace is waiting to be erased, so nobody is surprised by it. */
export function DeletionBanner({ requestedAt }: { requestedAt: string }) {
  const left = deletionDaysLeft(requestedAt);
  return (
    <div role="status" data-testid="deletion-banner" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm">
      <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
      <span>
        This workspace will be erased on <strong>{formatDayLong(deletionDate(requestedAt).slice(0, 10))}</strong> ({left} day{left === 1 ? "" : "s"} left).
      </span>
      <Link href="/app/setup?tab=data" className="font-medium text-primary underline-offset-2 hover:underline">Export your data or cancel</Link>
    </div>
  );
}
