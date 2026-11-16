// @vitest-environment jsdom
// Invoices, vendors and contacts save to the workspace database like licenses and tasks do: a loading state first,
// then the workspace's saved records, never the browser's old copy.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ContactsPage } from "@/components/contacts/contacts-page";
import { InvoicesPage } from "@/components/invoices/invoices-page";
import { VendorsPage } from "@/components/vendors/vendors-page";
import type { Rec } from "@/lib/records/diff";
import { configureRemote, stopRemote, type RecordsBackend } from "@/lib/records/remote";
import { PERSISTED_KINDS } from "@/lib/records/supabase-backend";
import { SAMPLE_SETS } from "@/lib/samples/data";
import { todayLocal } from "@/lib/dates";

/** A "database" that answers only when told to, so the loading state can be seen. */
function gate(rows: Rec[]) {
  let release!: () => void;
  const open = new Promise<void>((r) => { release = r; });
  const saves: { upserts: Rec[]; deletes: string[] }[] = [];
  const backend: RecordsBackend = {
    async load() { await open; return { records: rows, saved: true }; },
    async save(_kind, change) { saves.push({ upserts: change.upserts, deletes: change.deletes }); },
  };
  return { backend, saves, release: () => act(async () => { release(); await new Promise((r) => setTimeout(r, 0)); }) };
}

const sample = () => SAMPLE_SETS.find((s) => s.id === "small")!.build(todayLocal());
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => window.localStorage.clear());
afterEach(() => stopRemote());

describe("Invoices with a connected database", () => {
  it("shows a loading state first, then the workspace's saved invoices (not the browser's)", async () => {
    window.localStorage.setItem("adflo.records.invoices.v1", JSON.stringify([{ ...sample().invoices[0]!, id: "stale", client: "Old Browser Client" }]));
    const saved = sample().invoices.slice(0, 2).map((v, i) => ({ ...v, id: `db-${i}`, client: `Saved Invoice Client ${i + 1}` })) as unknown as Rec[];
    const db = gate(saved);
    configureRemote("ws-1", () => db.backend, PERSISTED_KINDS);
    const { container } = render(<InvoicesPage />);
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.queryByText("Old Browser Client")).toBeNull();
    await db.release();
    await settle();
    expect((await screen.findAllByText("Saved Invoice Client 1")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Saved Invoice Client 2").length).toBeGreaterThan(0);
    expect(screen.queryByText("Old Browser Client")).toBeNull();
  });
});

describe("Vendors with a connected database", () => {
  it("shows a loading state first, then the workspace's saved vendors (not the browser's)", async () => {
    window.localStorage.setItem("adflo.records.vendors.v1", JSON.stringify([{ ...sample().vendors[0]!, id: "stale", name: "Old Browser Vendor" }]));
    const saved = sample().vendors.slice(0, 2).map((v, i) => ({ ...v, id: `db-${i}`, name: `Saved Vendor ${i + 1}` })) as unknown as Rec[];
    const db = gate(saved);
    configureRemote("ws-1", () => db.backend, PERSISTED_KINDS);
    const { container } = render(<VendorsPage />);
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.queryByText("Old Browser Vendor")).toBeNull();
    await db.release();
    await settle();
    expect((await screen.findAllByText("Saved Vendor 1")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Saved Vendor 2").length).toBeGreaterThan(0);
    expect(screen.queryByText("Old Browser Vendor")).toBeNull();
  });
});

describe("Contacts with a connected database", () => {
  it("shows a loading state first, then the workspace's saved contacts (not the browser's)", async () => {
    window.localStorage.setItem("adflo.records.contacts.v1", JSON.stringify([{ ...sample().contacts[0]!, id: "stale", name: "Old Browser Contact" }]));
    const saved = sample().contacts.slice(0, 2).map((v, i) => ({ ...v, id: `db-${i}`, name: `Saved Contact ${i + 1}` })) as unknown as Rec[];
    const db = gate(saved);
    configureRemote("ws-1", () => db.backend, PERSISTED_KINDS);
    const { container } = render(<ContactsPage />);
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.queryByText("Old Browser Contact")).toBeNull();
    await db.release();
    await settle();
    expect((await screen.findAllByText("Saved Contact 1")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Saved Contact 2").length).toBeGreaterThan(0);
    expect(screen.queryByText("Old Browser Contact")).toBeNull();
  });
});
