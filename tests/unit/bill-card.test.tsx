// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BillCard } from "@/components/dms/bill-card";
import { DuplicateNote } from "@/components/dms/duplicate-note";
import type { DmsApi } from "@/lib/dms/client/api";
import type { BillRead, DocumentRecord } from "@/lib/dms/types";

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const doc = (o: Partial<DocumentRecord> = {}) => ({ id: "d1", displayName: "scan0042.pdf", category: "invoice", currentVersion: 1, createdAt: "2026-11-01T00:00:00Z", ...o }) as DocumentRecord;
const bill = (): BillRead => ({ status: "found", bill: { from: "Acme Supply Co", number: "INV-1042", issuedOn: inDays(-3), dueOn: inDays(20), totalCents: 112960 } });
const api = (read: BillRead | Error) => ({ readBill: vi.fn(async () => { if (read instanceof Error) throw read; return read; }) }) as unknown as DmsApi;
const reminders = () => JSON.parse(window.localStorage.getItem("adflo.reminders.v1") ?? "[]") as { id: string; text: string; on: string }[];

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe("BillCard", () => {
  it("shows what the document says", async () => {
    render(<BillCard doc={doc()} api={api(bill())} canEdit onRename={async () => true} />);
    expect(await screen.findByText("Acme Supply Co")).toBeInTheDocument();
    expect(screen.getByText("$1,129.60")).toBeInTheDocument();
    expect(screen.getByText("INV-1042")).toBeInTheDocument();
  });

  it("renames the file only when asked, and only for someone who can edit", async () => {
    const onRename = vi.fn(async () => true);
    const { unmount } = render(<BillCard doc={doc()} api={api(bill())} canEdit onRename={onRename} />);
    await userEvent.click(await screen.findByRole("button", { name: "Use as the file name" }));
    expect(onRename).toHaveBeenCalledWith(expect.stringMatching(/^Acme Supply Co - Invoice INV-1042 - /));
    unmount();
    render(<BillCard doc={doc()} api={api(bill())} canEdit={false} onRename={onRename} />);
    await screen.findByText("Acme Supply Co");
    expect(screen.queryByRole("button", { name: "Use as the file name" })).toBeNull();
  });

  it("puts a payment reminder on the due date, and can take it off", async () => {
    render(<BillCard doc={doc()} api={api(bill())} canEdit onRename={async () => true} />);
    await userEvent.click(await screen.findByRole("button", { name: "Remind me to pay it" }));
    expect(reminders()).toEqual([expect.objectContaining({ id: "rem-bill-d1", on: inDays(20), text: "Pay Acme Supply Co $1,129.60 (INV-1042)" })]);
    expect(await screen.findByRole("status")).toHaveTextContent("You will be reminded on");
    cleanup(); // open the document again
    render(<BillCard doc={doc()} api={api(bill())} canEdit onRename={async () => true} />);
    await userEvent.click(await screen.findByRole("button", { name: "Remove the payment reminder" }));
    expect(reminders()).toEqual([]);
  });

  it("offers no payment reminder on a receipt, and says plainly when nothing was read", async () => {
    const { unmount } = render(<BillCard doc={doc({ category: "receipt" })} api={api(bill())} canEdit onRename={async () => true} />);
    await screen.findByText("Acme Supply Co");
    expect(screen.queryByRole("button", { name: "Remind me to pay it" })).toBeNull();
    unmount();
    render(<BillCard doc={doc()} api={api({ status: "unreadable" })} canEdit onRename={async () => true} />);
    expect(await screen.findByText(/no readable text/)).toBeInTheDocument();
  });

  it("shows nothing for other kinds of document", () => {
    const { container } = render(<BillCard doc={doc({ category: "contract" })} api={api(bill())} canEdit onRename={async () => true} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("DuplicateNote", () => {
  it("lists files that look like copies, and opens one", async () => {
    const twin = doc({ id: "d2", displayName: "scan0042 (1).pdf" });
    const onOpen = vi.fn();
    render(<DuplicateNote doc={doc()} api={{ findDuplicates: async () => [twin] } as unknown as DmsApi} onOpen={onOpen} />);
    await userEvent.click(await screen.findByRole("button", { name: "scan0042 (1).pdf" }));
    expect(onOpen).toHaveBeenCalledWith("d2");
  });

  it("is absent when there are none", async () => {
    const { container } = render(<DuplicateNote doc={doc()} api={{ findDuplicates: async () => [] } as unknown as DmsApi} onOpen={() => undefined} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });
});
