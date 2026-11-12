import type { ReactNode } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";

export const LEGAL_UPDATED = "November 12, 2026";
export const LEGAL_CONTACT = process.env.NEXT_PUBLIC_SALES_EMAIL || "the contact address on our website";

/** Shared frame for the public legal pages. Text is a draft until a lawyer has reviewed it. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Brand wordmark className="w-36" />
          <nav aria-label="Legal" className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/subprocessors" className="hover:text-foreground">Sub-processors</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last updated {LEGAL_UPDATED}</p>
        <div className="mt-6 space-y-6 text-sm leading-relaxed [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-2 [&_section]:space-y-2">
          {children}
        </div>
      </main>
    </div>
  );
}
