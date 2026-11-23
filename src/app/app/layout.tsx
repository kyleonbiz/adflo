import { Suspense } from "react";
import { ShellSkeleton } from "@/components/modules/shell-skeleton";
import { renderAppLayout } from "@/lib/app-shell";

async function Shell({ children }: { children: React.ReactNode }) {
  return renderAppLayout(children);
}

// The menu, top bar and loaded records live here, so moving between pages does not rebuild them. On a full page load the
// skeleton draws at once and the real frame streams in when its lookups finish.
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return <Suspense fallback={<ShellSkeleton />}><Shell>{children}</Shell></Suspense>;
}
