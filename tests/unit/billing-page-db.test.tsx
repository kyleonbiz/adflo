// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ClientRecord, Plan } from "@/lib/control/types";
import type { Invoice } from "@/lib/invoices/types";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
// The invoice screen itself is covered elsewhere: here it only shows the list and lets the test change it.
vi.mock("@/components/invoices/invoices-page", () => ({
  InvoicesView: ({ invoices, onChange, headerActions }: { invoices: Invoice[]; onChange: (l: Invoice[]) => void; headerActions: React.ReactNode }) => (
    <div>
      <ul aria-label="Invoices">{invoices.map((i) => <li key={i.id}>{i.number}</li>)}</ul>
      <button onClick={() => onChange([...invoices, { ...invoices[0], id: "inv-new", number: "INV-NEW" }])}>Add one</button>
      <button onClick={() => onChange(invoices.filter((i) => i.id !== invoices[0].id))}>Remove first</button>
      {headerActions}
    </div>
  ),
}));

import { BillingPage } from "@/components/control/billing-page";

const inv = (o: Partial<Invoice> = {}): Invoice => ({ id: "inv-1", number: "INV-1", clientId: "c1", client: "Acme", clientEmail: "a@acme.test", description: "Plan", items: [{ description: "Plan", qty: 1, rateCents: 5000 }], taxRate: 0, sender: { name: "AdFlo", address: "", phone: "", email: "billing@adflo.pro" }, paymentMethods: [], amountCents: 5000, issuedOn: "2026-11-01", dueOn: "2026-11-15", status: "sent", paidOn: null, recurrence: "none", reminderDays: [], notes: "", ...o }) as Invoice;
const props = { clients: [] as ClientRecord[], plans: [] as Plan[], today: "2026-11-24", sample: false };
const sent = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => JSON.parse(c[1].body));

beforeEach(() => {
  window.localStorage.clear(); refresh.mockReset();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
});
afterEach(() => { window.localStorage.clear(); vi.unstubAllGlobals(); });

describe("BillingPage with the database", () => {
  it("shows the saved invoices and says they are in the database", () => {
    render(<BillingPage {...props} invoices={[inv()]} />);
    expect(screen.getByRole("list", { name: "Invoices" })).toHaveTextContent("INV-1");
    expect(screen.queryByText(/live in this browser only/)).toBeNull();
  });

  it("sends only what changed, and shows it at once", async () => {
    render(<BillingPage {...props} invoices={[inv()]} />);
    await userEvent.click(screen.getByRole("button", { name: "Add one" }));
    expect(screen.getByRole("list", { name: "Invoices" })).toHaveTextContent("INV-NEW");
    await waitFor(() => expect(sent()).toHaveLength(1));
    expect(sent()[0].upsert.map((i: Invoice) => i.id)).toEqual(["inv-new"]);
    expect(sent()[0].remove).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Remove first" }));
    await waitFor(() => expect(sent()).toHaveLength(2));
    expect(sent()[1]).toMatchObject({ upsert: [], remove: ["inv-1"] });
  });

  it("puts a refused change back and says so", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: { message: "Your role cannot change invoices." } }), { status: 403 })));
    render(<BillingPage {...props} invoices={[inv()]} />);
    await userEvent.click(screen.getByRole("button", { name: "Add one" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your role cannot change invoices. That change was not saved.");
    expect(screen.getByRole("list", { name: "Invoices" })).not.toHaveTextContent("INV-NEW");
    expect(refresh).toHaveBeenCalled();
  });

  it("offers to move invoices that were saved in this browser, then clears them", async () => {
    window.localStorage.setItem("adflo.control.invoices.v2", JSON.stringify([inv({ id: "old-1", number: "INV-OLD" }), inv()]));
    render(<BillingPage {...props} invoices={[inv()]} />);
    expect(await screen.findByText(/1 invoice is saved only in this browser/)).toBeInTheDocument(); // the one already in the database is not counted
    await userEvent.click(screen.getByRole("button", { name: "Move to the database" }));
    await waitFor(() => expect(sent()).toHaveLength(1));
    expect(sent()[0].upsert.map((i: Invoice) => i.id)).toEqual(["old-1"]);
    expect(await screen.findByRole("status")).toHaveTextContent("Moved 1 invoice");
    await waitFor(() => expect(screen.queryByText(/saved only in this browser/)).toBeNull());
  });

  it("keeps the browser copy when moving fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: { message: "Could not save." } }), { status: 500 })));
    window.localStorage.setItem("adflo.control.invoices.v2", JSON.stringify([inv({ id: "old-1", number: "INV-OLD" })]));
    render(<BillingPage {...props} invoices={[]} />);
    await userEvent.click(await screen.findByRole("button", { name: "Move to the database" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nothing more was moved");
    expect(window.localStorage.getItem("adflo.control.invoices.v2")).toContain("old-1");
  });
});

describe("BillingPage in the preview", () => {
  it("still keeps invoices in the browser and says so", () => {
    render(<BillingPage {...props} sample />);
    expect(screen.getByText(/Billing invoices live in this browser only/)).toBeInTheDocument();
  });
});
