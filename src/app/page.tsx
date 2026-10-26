import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { DemoWorkspace } from "@/components/marketing/demo-workspace";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks, ModuleGrid, Principles } from "@/components/marketing/sections";

export default function HomePage() {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <header className="absolute inset-x-0 top-0 z-10">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6" aria-label="Main">
          <Brand light />
          <div className="flex items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden text-white hover:bg-white/10 hover:text-white sm:inline-flex">
              <a href="#modules">Modules</a>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden text-white hover:bg-white/10 hover:text-white sm:inline-flex">
              <a href="#how">How it works</a>
            </Button>
            <Button asChild variant="outline" size="sm" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Link href="/app">Open workspace</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <Hero />
        <ModuleGrid />
        <HowItWorks />
        <Principles />
        <section id="demo" aria-labelledby="demo-title" className="hero-gradient scroll-mt-6 px-3 py-16 text-white sm:px-6">
          <div className="mx-auto max-w-7xl">
            <h2 id="demo-title" className="text-center text-3xl font-semibold tracking-tight">Try the document manager right here</h2>
            <p className="mx-auto mb-8 mt-3 max-w-2xl text-center text-white/85">
              Upload, search, tag and share. It is the real thing running on sample files in your browser.
            </p>
            <div className="glass-frame rounded-[28px] p-2.5 text-foreground sm:p-5">
              <DemoWorkspace />
            </div>
            <div className="mt-10 text-center">
              <Button asChild size="lg" className="bg-white text-indigo-700 shadow-lg shadow-black/10 hover:bg-white/90">
                <Link href="/demo/overview">See all the modules in the demo</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-indigo-100 bg-white/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Aurum Ventura Enterprise LLC · Business Administrative Services
      </footer>
    </div>
  );
}
