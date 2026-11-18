import { LogOut } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";

/**
 * Shown when someone signs in but no AdFlo workspace is set up for their email yet. Workspaces are created by AdFlo in the
 * Control center (or come from an owner's team invitation), so a visitor is never asked to create one themselves.
 */
export function NoWorkspaceNotice({ email }: { email: string }) {
  return (
    <AuthCard title="Your workspace is not ready yet" subtitle={email ? `Signed in as ${email}` : "AdFlo"}>
      <p className="text-sm text-muted-foreground">
        We could not find a workspace for this email. If you were invited, sign in with the exact email the invitation was sent to. Otherwise, email{" "}
        <a href="mailto:support@adflo.pro" className="font-medium text-primary hover:underline">support@adflo.pro</a> and we will get you set up.
      </p>
      <form action="/auth/signout" method="post" className="mt-5">
        <Button type="submit" variant="outline"><LogOut /> Sign out</Button>
      </form>
    </AuthCard>
  );
}
