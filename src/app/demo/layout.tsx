import Link from "next/link";
import { AppFrame } from "@/components/modules/app-frame";
import { Button } from "@/components/ui/button";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppFrame
      base="/demo"
      topRight={
        <>
          <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">Demo</span>
          <Button asChild variant="outline" size="sm"><Link href="/app">Open workspace</Link></Button>
        </>
      }
    >
      {children}
    </AppFrame>
  );
}
