import Link from "next/link";
import { CircleHelp, LogOut, ShieldCheck } from "lucide-react";
import { ControlBell } from "@/components/control/control-bell";
import { NotificationBell } from "@/components/notification-bell";
import type { ControlAlert } from "@/lib/control/alerts";
import type { AttentionItem } from "@/lib/dashboard/logic";
import { Button } from "@/components/ui/button";

/** The right-hand side of the top bar for signed-in pages: workspace name, mode badge, who is signed in. */
export function AppTopBar({ workspaceName, userLabel, badge, notifications, controlAlerts, signOutTo, isStaff, supportItems }: { workspaceName?: string; userLabel?: string; badge?: string; signOutTo?: "control"; notifications?: { today: string }; /** The Control center bell: given only on staff pages. */ controlAlerts?: ControlAlert[]; isStaff?: boolean; /** Replies from AdFlo Support, shown in the bell. */ supportItems?: AttentionItem[] }) {
  return (
    <>
      {notifications && (
        <Link href="/app/help" className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand-sky">
          <CircleHelp className="size-4" aria-hidden /> <span className="hidden sm:inline">Help &amp; Training</span><span className="sr-only sm:hidden">Help &amp; Training</span>
        </Link>
      )}
      {isStaff && (
        <Link href="/control" className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand-sky">
          <ShieldCheck className="size-4" aria-hidden /> <span className="hidden sm:inline">Control center</span><span className="sr-only sm:hidden">Control center</span>
        </Link>
      )}
      {notifications && <NotificationBell serverToday={notifications.today} extra={supportItems} />}
      {controlAlerts && <ControlBell items={controlAlerts} />}
      {workspaceName && (
        <span className="hidden truncate rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground sm:inline">{workspaceName}</span>
      )}
      {badge && <span className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground">{badge}</span>}
      {userLabel && (
        <form action="/auth/signout" method="post" className="flex items-center gap-2">
          {signOutTo && <input type="hidden" name="to" value={signOutTo} />}
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-blue/15 text-sm font-semibold uppercase text-brand-blue">{userLabel.trim().charAt(0)}</span>
          <span className="hidden max-w-48 truncate text-sm font-medium md:inline">{userLabel}</span>
          <Button type="submit" variant="outline" size="sm">
            <LogOut /> <span className="sr-only sm:not-sr-only">Sign out</span>
          </Button>
        </form>
      )}
    </>
  );
}
