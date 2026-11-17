import Link from "next/link";
import { Brand } from "@/components/brand";
import { AuthBackdrop } from "@/components/auth/auth-backdrop";
import { Button } from "@/components/ui/button";
import { DemoWorkspace } from "@/components/marketing/demo-workspace";
import { Hero } from "@/components/marketing/hero";
import { LandingSections } from "@/components/marketing/sections";

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="hero-gradient relative isolate flex-1 overflow-hidden">
        {/* The same ribbons, skyline and waves as the sign-in screen, behind the top of the page and fading out below it. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[860px] overflow-hidden [mask-image:linear-gradient(to_bottom,#000_78%,transparent)]">
          <AuthBackdrop />
        </div>
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6" aria-label="Main">
          <Brand wordmark light className="w-28 sm:w-32" />
          <div className="flex items-center gap-2">
          <a href="#demo" className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-white/90 hover:text-white sm:block">Book a demo</a>
          <Button asChild size="sm" className="rounded-full border-0 bg-gradient-to-r from-brand-sky via-brand-blue to-brand-violet px-5 text-white shadow-lg shadow-brand-purple/40 hover:brightness-110">
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
      </footer>
    </div>
  );
}
