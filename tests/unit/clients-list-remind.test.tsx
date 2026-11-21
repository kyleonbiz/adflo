// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
import { ClientsPage } from "@/components/control/clients-page";
import type { ClientRecord } from "@/lib/control/types";

const base: ClientRecord = {
  id: "7a000000-0000-4000-8000-0000000000c1", name: "Pending Co", status: "trial", plan: "standard", seatsLimit: 3, ownerName: "Pat Lee", ownerEmail: "pat@pending.test",
  notes: "", workspaceId: "w1", startedOn: "2026-11-10", createdAt: "2026-11-10T00:00:00Z", priceOverrideCents: null, priceNote: "", seatsUsed: 0, lastActive: null, checklist: [],
};
const clients: ClientRecord[] = [
  base,
  { ...base, id: "7a000000-0000-4000-8000-0000000000c2", name: "Joined Co", ownerEmail: "joe@joined.test", seatsUsed: 2 },
  { ...base, id: "7a000000-0000-4000-8000-0000000000c3", name: "No Workspace Co", ownerEmail: "nw@nowork.test", workspaceId: null },
];

const calls: string[] = [];
beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal("fetch", vi.fn((url: string, init?: { body?: string }) => {
    calls.push(`${url} ${init?.body ?? ""}`.trim());
    return Promise.resolve(new Response(JSON.stringify({ ok: true, emailedTo: "pat@pending.test" }), { status: 200 }));
  }));
});
afterEach(() => vi.unstubAllGlobals());

const page = (over: Partial<{ clients: ClientRecord[]; canEdit: boolean }> = {}) => render(<ClientsPage clients={over.clients ?? clients} plans={[]} canEdit={over.canEdit ?? true} today="2026-11-20" />);

describe("Clients list: Remind about a pending invitation", () => {
  it("is offered only to a client with a workspace whose owner has not joined", () => {
    page();
    expect(screen.getByRole("button", { name: "Remind Pending Co about their invitation" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remind Joined Co/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remind No Workspace Co/ })).toBeNull();
  });

  it("asks first, then sends the signup reminder and says who it went to", async () => {
    page();
    await userEvent.click(screen.getByRole("button", { name: /Remind Pending Co/ }));
    expect(calls).toHaveLength(0);
    await userEvent.click(await screen.findByRole("button", { name: "Send" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toContain("/api/control/clients/7a000000-0000-4000-8000-0000000000c1/remind");
    expect(calls[0]).toContain('"kind":"signup"');
    expect(await screen.findByText(/Reminder sent to pat@pending.test/)).toBeInTheDocument();
  });

  it("sends nothing when the confirm is declined", async () => {
    page();
    await userEvent.click(screen.getByRole("button", { name: /Remind Pending Co/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(calls).toHaveLength(0);
  });

  it("waits out the daily limit", () => {
    page({ clients: [{ ...base, lastReminderAt: new Date(Date.now() - 3_600_000).toISOString() }] });
    expect(screen.getByRole("button", { name: /Remind Pending Co/ })).toBeDisabled();
  });

  it("is not shown to read-only staff", () => {
    page({ canEdit: false });
    expect(screen.queryByRole("button", { name: /Remind/ })).toBeNull();
  });
});
