import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The right-hand side of the top bar for signed-in pages: workspace name, mode badge, who is signed in. */
export function AppTopBar({ workspaceName, userLabel, badge }: { workspaceName?: string; userLabel?: string; badge?: string }) {
  return (
    <>
      {workspaceName && (
        <span className="hidden truncate rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground sm:inline">{workspaceName}</span>
      )}
      {badge && <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">{badge}</span>}
      {userLabel && (
        <form action="/auth/signout" method="post" className="flex items-center gap-2">
          <span className="hidden max-w-48 truncate text-sm text-muted-foreground md:inline">{userLabel}</span>
          <Button type="submit" variant="outline" size="sm">
            <LogOut /> <span className="sr-only sm:not-sr-only">Sign out</span>
          </Button>
        </form>
      )}
    </>
  );
}
