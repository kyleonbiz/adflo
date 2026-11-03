import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "people", label: "People", href: "/app/contacts" },
  { id: "vendors", label: "Vendors", href: "/app/vendors" },
] as const;

/** Customers and vendors are one address book; this switches between the two views of it. */
export function ContactsTabs({ current }: { current: (typeof TABS)[number]["id"] }) {
  return (
    <nav aria-label="Contacts" className="flex gap-1 border-b">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={t.id === current ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            t.id === current ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
