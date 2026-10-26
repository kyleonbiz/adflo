"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Search, SlidersHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MODULES, moduleHref } from "@/lib/modules/registry";

/** Services whose list has its own search box, which a `?q=` link fills in. */
const RECORD_SEARCH = new Set(["documents", "invoices", "licenses", "vendors", "crm", "projects", "forms", "admin"]);
const RECORD_NOUN: Record<string, string> = {
  documents: "documents", invoices: "invoices", licenses: "licenses", vendors: "vendors", crm: "contacts", projects: "projects", forms: "forms", admin: "requests",
};

export interface SearchResult { key: string; title: string; detail: string; href: string }

/** Everything the box offers for `query`: matching services, then a "search inside" link per service that has records. */
export function searchResults(query: string, scope: string): SearchResult[] {
  const q = query.trim();
  if (!q) return [];
  const inside: SearchResult[] = MODULES.flatMap((m) => {
    const href = moduleHref(m, "/app");
    if (!href || !RECORD_SEARCH.has(m.id) || (scope !== "all" && scope !== m.id)) return [];
    return [{ key: `in-${m.id}`, title: `Search ${RECORD_NOUN[m.id]} for “${q}”`, detail: m.name, href: `${href}?q=${encodeURIComponent(q)}` }];
  });
  if (scope !== "all") return inside;
  const services: SearchResult[] = matchModules(q).map((r) => ({ key: r.module.id, title: r.module.name, detail: r.module.summary, href: r.href }));
  return [...services, ...inside];
}

/** Services whose name or summary contains every word typed, name matches first. */
export function matchModules(query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return MODULES.flatMap((m) => {
    const href = moduleHref(m, "/app");
    if (!href) return [];
    const name = m.name.toLowerCase();
    const hay = `${name} ${m.summary.toLowerCase()}`;
    if (!words.every((w) => hay.includes(w))) return [];
    return [{ module: m, href, rank: words.every((w) => name.includes(w)) ? 0 : 1 }];
  }).sort((a, b) => a.rank - b.rank);
}

/** The search box in the top bar: type a service or topic, pick a result (or press Enter) to jump there. */
export function GlobalSearch() {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [scope, setScope] = useState("all");
  const results = useMemo(() => searchResults(query, scope), [query, scope]);
  const scopeName = scope === "all" ? "" : MODULES.find((m) => m.id === scope)?.name ?? "";
  const showList = open && query.trim().length > 0;

  // Pressing "/" anywhere outside a text field jumps to the box. Both copies (top bar and phone row) are
  // mounted, so only the visible one takes focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const el = inputRef.current;
      if (!el || el.offsetParent === null) return;
      e.preventDefault();
      el.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(href: string) {
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    router.push(href);
  }

  return (
    <div className="relative w-full max-w-xl" role="search">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder={scopeName ? `Search ${scopeName}` : "Search Adflo"}
        aria-label="Search Adflo"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-11 text-sm italic shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:not-italic focus-visible:ring-2 focus-visible:ring-ring/30 [&:not(:placeholder-shown)]:not-italic"
        onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
          else if (e.key === "Enter" && results[active]) { e.preventDefault(); go(results[active].href); }
          else if (e.key === "Escape") { setOpen(false); }
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Choose where to search" className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            <SlidersHorizontal className="size-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {[{ id: "all", name: "All services" }, ...MODULES.filter((m) => RECORD_SEARCH.has(m.id))].map((o) => (
            <DropdownMenuItem key={o.id} onSelect={() => { setScope(o.id); setActive(0); setOpen(true); inputRef.current?.focus(); }}>
              <span className="flex-1">{o.name}</span>
              {scope === o.id && <Check className="size-4" aria-hidden />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {showList && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-11 z-40 max-h-80 overflow-y-auto rounded-lg border bg-card p-1 shadow-float">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matches for “{query.trim()}”.</li>
          ) : results.map((r, i) => (
            <li
              key={r.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); go(r.href); }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer rounded-md px-3 py-2 ${i === active ? "bg-muted" : ""}`}
            >
              <div className="text-sm font-medium">{r.title}</div>
              <div className="truncate text-xs text-muted-foreground">{r.detail}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
