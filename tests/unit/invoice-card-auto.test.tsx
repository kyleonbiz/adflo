// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceCard, type InvoiceActions } from "@/components/invoices/invoice-card";
import type { Invoice } from "@/lib/invoices/types";

const inv = (o: Partial<Invoice> = {}): Invoice => ({
  id: "i1", number: "INV-0042", client: "Northwind", clientEmail: "ap@northwind.test", description: "Roof repair", items: [{ description: "Roof repair", qty: 1, rateCents: 482000 }], taxRate: 0,
  sender: { name: "Acme", address: "", phone: "", email: "" }, paymentMethods: [], amountCents: 482000, issuedOn: "2026-11-01", dueOn: "2026-11-15", status: "sent", paidOn: null,
  recurrence: "monthly", reminderDays: [7, 1], notes: "", ...o,
});
const actions = new Proxy({}, { get: () => vi.fn() }) as unknown as InvoiceActions;

describe("Invoice card: automatic activity", () => {
  it("says when an invoice was created automatically and how many times the client was reminded", () => {
    render(<InvoiceCard invoice={inv({ autoCreatedOn: "2026-11-01", remindersSent: ["2026-11-08", "2026-11-14"] })} today="2026-11-15" actions={actions} />);
    expect(screen.getByText("Created automatically")).toBeInTheDocument();
    expect(screen.getByText("Reminded 2 times")).toBeInTheDocument();
  });

  it("says nothing for an invoice made and chased by hand", () => {
    render(<InvoiceCard invoice={inv()} today="2026-11-15" actions={actions} />);
    expect(screen.queryByText("Created automatically")).toBeNull();
    expect(screen.queryByText(/^Reminded/)).toBeNull();
  });

  it("uses the singular for one reminder", () => {
    render(<InvoiceCard invoice={inv({ remindersSent: ["2026-11-08"] })} today="2026-11-15" actions={actions} />);
    expect(screen.getByText("Reminded 1 time")).toBeInTheDocument();
  });
});
