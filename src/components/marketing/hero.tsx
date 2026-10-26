import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="hero-gradient relative text-white" aria-labelledby="hero-title">
      <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-28 text-center sm:px-6 sm:pb-20 sm:pt-32">
        <p className="mx-auto inline-block rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
          Business administration, as software
        </p>
        <h1 id="hero-title" className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          Your back office, in one place.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-white/90 sm:text-lg">
          AdFlo turns the paperwork, invoices, renewals and projects you used to hand off into simple tools your team runs itself.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="bg-white text-indigo-700 shadow-lg shadow-black/10 hover:bg-white/90">
            <Link href="/demo/overview">Try the demo <ArrowRight /></Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            <a href="#modules">Explore the modules</a>
          </Button>
        </div>
        <p className="mt-4 text-sm text-white/75">No sign-up. The demo runs on sample data in your browser.</p>
      </div>
    </section>
  );
}
