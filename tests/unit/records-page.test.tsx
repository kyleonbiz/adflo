// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LicensesPage } from "@/components/licenses/licenses-page";
import type { Rec } from "@/lib/records/diff";
import { RecordsSyncError, configureRemote, stopRemote, type RecordsBackend } from "@/lib/records/remote";
import { sampleLicenses } from "../support/licenses-sample-data";
import { todayLocal } from "@/lib/dates";

/** A "database" that answers only when told to, so the loading state can be seen. */
function gate(initial: Rec[] | null) {
  let release!: () => void;
  const open = new Promise<void>((r) => { release = r; });
  const saves: { upserts: Rec[]; deletes: string[] }[] = [];
  let rows = initial;
  const backend: RecordsBackend = {
    async load() { await open; return { records: rows ?? [], saved: rows !== null }; },
    async save(_k, change) {
      if (rows === null && change.upserts.length === 0 && change.deletes.length === 0 && !change.markSaved) throw new RecordsSyncError("failed");
      saves.push({ upserts: change.upserts, deletes: change.deletes });
      const map = new Map((rows ?? []).map((r) => [r.id, r]));
      for (const r of change.upserts) map.set(r.id, r);
      for (const id of change.deletes) map.delete(id);
      rows = [...map.values()];
    },
  };
  return { backend, release: () => act(async () => { release(); await new Promise((r) => setTimeout(r, 0)); }), saves };
}

beforeEach(() => window.localStorage.clear());
afterEach(() => stopRemote());

describe("Licenses with a connected database", () => {
  it("shows a loading state first, then the workspace's saved licenses (not the browser's)", async () => {
    window.localStorage.setItem("adflo.records.licenses.v1", JSON.stringify([{ ...sampleLicenses(todayLocal())[0]!, id: "stale", name: "Old browser copy" }]));
    const saved = sampleLicenses(todayLocal()).slice(0, 2).map((l, i) => ({ ...l, id: `db-${i}`, name: `Saved license ${i + 1}` })) as unknown as Rec[];
    const db = gate(saved);
    configureRemote("ws-1", () => db.backend, ["licenses", "projects"]);
    const { container } = render(<LicensesPage />);
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.queryByText("Old browser copy")).toBeNull();
    await db.release();
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(await screen.findByText("Saved license 1")).toBeTruthy();
    expect(screen.getByText("Saved license 2")).toBeTruthy();
    expect(screen.queryByText("Old browser copy")).toBeNull();
  });

  it("saves a change made on the page to the database", async () => {
    const saved = sampleLicenses(todayLocal()).slice(0, 1).map((l) => ({ ...l, id: "db-1", name: "Saved license 1" })) as unknown as Rec[];
    const db = gate(saved);
    configureRemote("ws-1", () => db.backend, ["licenses", "projects"]);
    render(<LicensesPage />);
    await db.release();
    await screen.findByText("Saved license 1");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete Saved license 1" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(db.saves.flatMap((s) => s.deletes)).toContain("db-1");
  });
});
