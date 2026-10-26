"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { MODULES, moduleHref } from "@/lib/modules/registry";

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
  const results = useMemo(() => matchModules(query), [query]);
  const showList = open && query.trim().length > 0;

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
        placeholder="Search Adflo"
        aria-label="Search Adflo"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm italic shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:not-italic focus-visible:ring-2 focus-visible:ring-ring/30 [&:not(:placeholder-shown)]:not-italic"
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
      {showList && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-11 z-40 max-h-80 overflow-y-auto rounded-lg border bg-card p-1 shadow-float">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matches for “{query.trim()}”.</li>
          ) : results.map((r, i) => (
            <li
              key={r.module.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); go(r.href); }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer rounded-md px-3 py-2 ${i === active ? "bg-muted" : ""}`}
            >
              <div className="text-sm font-medium">{r.module.name}</div>
              <div className="truncate text-xs text-muted-foreground">{r.module.summary}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
