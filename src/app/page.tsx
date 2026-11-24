import Link from "next/link";
import { Brand } from "@/components/brand";
import { AuthBackdrop } from "@/components/auth/auth-backdrop";
import { Button } from "@/components/ui/button";
import { DemoWorkspace } from "@/components/marketing/demo-workspace";
import { Hero } from "@/components/marketing/hero";
import { LandingSections } from "@/components/marketing/sections";

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-[#040826]">
      <div className="hero-gradient relative isolate overflow-hidden">
        {/* The same faint grid as the sign-in screen, behind the top of the page and fading out below it. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[860px] overflow-hidden [mask-image:linear-gradient(to_bottom,#000_78%,transparent)]">
          <AuthBackdrop />
        </div>
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6" aria-label="Main">
          <Brand wordmark light className="w-28 sm:w-32" />
          <div className="flex items-center gap-2">
          <a href="#platform" className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-white/90 hover:text-white sm:block">Platform</a>
          <a href="#who" className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-white/90 hover:text-white sm:block">Solutions</a>
          <a href="#faq" className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-white/90 hover:text-white sm:block">Resources</a>
          <Link href="/login" className="px-2 py-1.5 text-sm font-medium text-white/90 hover:text-white">Sign In</Link>
          <Button asChild size="sm" className="px-4">
            <Link href="/signup">Get Started</Link>
          </Button>
          </div>
        </nav>
        <main>
          <Hero />
          <div className="mx-auto max-w-5xl px-3 pb-16 sm:px-6">
            <div className="glass-frame rounded-xl p-2.5 sm:p-5">
              <DemoWorkspace />
            </div>
          </div>
        </main>
      </div>
      {/* Below the demo the page switches to the app's own look: a quiet grey page with flat white cards. */}
      <div className="landing-light relative flex-1 text-foreground">
        <LandingSections />
        <footer className="border-t bg-white py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} AdFlo · Administrative management platform ·{" "}
          <a href="#pricing" className="underline underline-offset-2 hover:text-foreground">Pricing</a> ·{" "}
          <Link href="/partners" className="underline underline-offset-2 hover:text-foreground">Partners</Link> ·{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy</Link>
        </footer>
      </div>
    </div>
  );
}
