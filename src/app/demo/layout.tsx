import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Brand />
            <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">Demo</span>
          </div>
          <Button asChild variant="outline" size="sm"><Link href="/app">Open workspace</Link></Button>
        </div>
      </header>
      {children}
    </div>
  );
}
