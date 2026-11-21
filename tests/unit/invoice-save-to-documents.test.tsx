// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoicesView } from "@/components/invoices/invoices-page";
import type { DmsApi } from "@/lib/dms/client/api";
import { invoiceFileName, saveInvoiceToDocuments } from "@/lib/invoices/save-to-documents";
import type { Invoice } from "@/lib/invoices/types";

const inv = (over: Partial<Invoice> = {}): Invoice => ({
  id: "i1", number: "INV-7 / A", client: "Acme", clientEmail: "", description: "Work", items: [{ description: "Work", qty: 1, rateCents: 10000 }], taxRate: 0,
  sender: { name: "Me", address: "", phone: "", email: "" }, paymentMethods: [], amountCents: 10000, issuedOn: "2026-11-01", dueOn: "2026-12-01",
  status: "draft", paidOn: null, recurrence: "none", reminderDays: [], notes: "", ...over,
});

const fakeApi = (folders: { id: string; name: string; isSystem: boolean }[] = [{ id: "f-inv", name: "Invoices", isSystem: true }]) => {
  const uploadFile = vi.fn(async (...args: unknown[]) => { void args; return {} as never; });
  const api = { bootstrap: async () => ({ folders }), uploadFile } as unknown as DmsApi;
  return { api, uploadFile };
};

/** The invoices screen over a list it keeps itself, as the real page does. */
function Harness({ api, start = [], startNew, onList }: { api?: DmsApi; start?: Invoice[]; startNew?: boolean; onList?: (l: Invoice[]) => void }) {
  const [list, setList] = useState(start);
  return <InvoicesView invoices={list} onChange={(n) => { setList(n); onList?.(n); }} audit={() => {}} documentsApi={api} startNew={startNew} />;
}

describe("saveInvoiceToDocuments", () => {
  it("uploads a PDF into the Invoices folder under the Invoice category", async () => {
    const { api, uploadFile } = fakeApi([{ id: "f-other", name: "Contracts", isSystem: true }, { id: "f-inv", name: "Invoices", isSystem: true }]);
    const r = await saveInvoiceToDocuments(api, inv());
    expect(r).toEqual({ fileName: "invoice-INV-7_A.pdf", folder: "Invoices" });
    const args = uploadFile.mock.calls[0]![0] as { file: File; folderId: string | null; category: string };
    expect(args.folderId).toBe("f-inv");
    expect(args.category).toBe("invoice");
    expect(args.file.type).toBe("application/pdf");
    expect(args.file.name).toBe(invoiceFileName(inv()));
  });
  it("falls back to the top level when there is no Invoices folder, and reports a failure in plain words", async () => {
    const { api, uploadFile } = fakeApi([]);
    expect((await saveInvoiceToDocuments(api, inv())).folder).toBe("Documents");
    expect((uploadFile.mock.calls[0]![0] as { folderId: unknown }).folderId).toBeNull();
    const bad = { bootstrap: async () => { throw new Error("offline"); } } as unknown as DmsApi;
    await expect(saveInvoiceToDocuments(bad, inv())).rejects.toBeInstanceOf(Error);
  });
});

describe("Invoices screen", () => {
  beforeEach(() => window.localStorage.clear());

  it("offers Save to Documents on an invoice and marks it as saved", async () => {
    const { api, uploadFile } = fakeApi();
    render(<Harness api={api} start={[inv()]} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^More actions for / }));
    await user.click(await screen.findByRole("menuitem", { name: "Save to Documents" }));
    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("In Documents")).toBeTruthy();
  });

  it("creating a new invoice with the box ticked saves a copy to Documents, and unticked does not", async () => {
    const fill = async (client: string, tick: boolean) => {
      const { api, uploadFile } = fakeApi();
      let list: Invoice[] = [];
      const { unmount } = render(<Harness api={api} startNew onList={(l) => { list = l; }} />);
      const user = userEvent.setup();
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText("Business name"), "Sample Co");
      await user.type(within(dialog).getByLabelText("Client", { exact: true }), client);
      await user.type(within(dialog).getByLabelText("Description", { exact: true }), "Setup");
      await user.type(within(dialog).getByLabelText("Rate", { exact: true }), "100");
      if (!tick) await user.click(within(dialog).getByRole("checkbox", { name: /save a PDF copy to Documents/i }));
      await user.click(within(dialog).getByRole("button", { name: "Create invoice" }));
      await waitFor(() => expect(list).toHaveLength(1));
      await new Promise((r) => setTimeout(r, 100));
      expect(list).toHaveLength(1); // saving the copy must not drop the new invoice
      unmount();
      return uploadFile.mock.calls.length;
    };
    expect(await fill("Globex", true)).toBe(1);
    expect(await fill("Initech", false)).toBe(0);
  });

  it("does not offer it without a Documents connection", async () => {
    render(<InvoicesView invoices={[inv()]} onChange={() => {}} audit={() => {}} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^More actions for / }));
    expect(screen.queryByRole("menuitem", { name: /to Documents/ })).toBeNull();
  });

  it("the new-invoice form has the checkbox, on by default, only when Documents is connected", async () => {
    const { api } = fakeApi();
    render(<InvoicesView invoices={[]} onChange={() => {}} audit={() => {}} documentsApi={api} startNew />);
    const dialog = await screen.findByRole("dialog");
    expect((within(dialog).getByRole("checkbox", { name: /save a PDF copy to Documents/i }) as HTMLInputElement).checked).toBe(true);
  });
});
