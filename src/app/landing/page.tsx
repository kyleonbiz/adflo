import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { DemoWorkspace } from "@/components/marketing/demo-workspace";
import { Hero } from "@/components/marketing/hero";
import { LandingSections } from "@/components/marketing/sections";

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="hero-gradient flex-1">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6" aria-label="Main">
          <Brand light />
          <div className="flex items-center gap-2">
          <a href="#demo" className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-white/90 hover:text-white sm:block">Book a demo</a>
          <Button asChild variant="outline" size="sm" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            <Link href="/app">Open workspace</Link>
          </Button>
          </div>
        </nav>
        <main>
          <Hero />
          <div className="mx-auto max-w-7xl px-3 pb-16 sm:px-6">
            <div className="glass-frame rounded-[28px] p-2.5 sm:p-5">
              <DemoWorkspace />
            </div>
          </div>
          <LandingSections />
        </main>
      </div>
      <footer className="border-t border-indigo-100 bg-white/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} AdFlo · Business Administrative Services
        <span className="mt-2 flex justify-center gap-4"><Link href="/terms" className="underline">Terms</Link><Link href="/privacy" className="underline">Privacy</Link><Link href="/subprocessors" className="underline">Sub-processors</Link></span>
      </footer>
    </div>
  );
}
