// @vitest-environment jsdom
// The records provider holds the page area back until every database-backed service and the activity trail have
// loaded: the setup answers decide whether the setup guide shows, so nothing may draw from defaults first.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { stopActivity } from "@/lib/audit/remote";
import { stopRemote } from "@/lib/records/remote";

let release!: () => void;
let gate: Promise<void>;
let failing = false;
const requested: string[] = [];

/** A Supabase client whose every request waits for `release`, then answers with an empty table (or an error). */
vi.mock("@/lib/supabase/browser", () => ({
  createBrowserSupabase: () => ({
    from: (table: string) => {
      requested.push(table);
      const q: unknown = new Proxy(function () { /* chainable */ }, {
        get: (_t, prop) => prop === "then"
          ? (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => gate.then(() => (failing ? { data: null, error: { code: "08006", message: "down" } } : { data: [], error: null })).then(ok, bad)
          : () => q,
      });
      return q;
    },
  }),
}));

import { RecordsProvider } from "@/components/records-provider";

beforeEach(() => {
  failing = false;
  requested.length = 0;
  gate = new Promise<void>((r) => { release = r; });
});
afterEach(() => { stopRemote(); stopActivity(); });

const settle = () => act(async () => { release(); await new Promise((r) => setTimeout(r, 0)); });

describe("RecordsProvider", () => {
  it("shows a loading block, not the page, until the saved records and the trail have loaded", async () => {
    render(<RecordsProvider workspaceId="ws-1"><p>The page</p></RecordsProvider>);
    expect(screen.getByTestId("records-loading")).toBeTruthy();
    expect(screen.queryByText("The page")).toBeNull();
    await settle();
    expect(screen.queryByTestId("records-loading")).toBeNull();
    expect(screen.getByText("The page")).toBeTruthy();
  });

  it("loads every shared service and the activity trail", async () => {
    render(<RecordsProvider workspaceId="ws-1"><p>The page</p></RecordsProvider>);
    await settle();
    expect(requested).toContain("workspace_records");
    expect(requested).toContain("workspace_record_sets");
    expect(requested).toContain("workspace_activity");
  });

  it("keeps the page back, and says so, when the saved records cannot be loaded", async () => {
    failing = true;
    render(<RecordsProvider workspaceId="ws-1"><p>The page</p></RecordsProvider>);
    await settle();
    expect(screen.queryByText("The page")).toBeNull();
    expect(screen.getByTestId("records-problem").textContent).toContain("could not load");
  });
});
