// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const state = vi.hoisted(() => ({ connected: true }));
vi.mock("@/lib/records/storage", async (orig) => ({ ...(await orig<typeof import("@/lib/records/storage")>()), useRecordsInDatabase: () => state.connected }));

import { Packets } from "@/components/forms/packets";
import { PACKETS, startPacket, type Assignment } from "@/lib/packets/logic";

const KEY = "adflo.packets.v1";
const TODAY = "2026-11-20";
const seed = (...list: Assignment[]) => window.localStorage.setItem(KEY, JSON.stringify(list));
const saved = () => JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as Assignment[];
const hire = (o: Partial<Assignment> = {}): Assignment => ({ ...startPacket(PACKETS.find((p) => p.id === "pk-hire")!, "Jordan Cruz", "jordan@example.com", "2026-11-10", "p1"), ...o });
const view = () => render(<Packets today={TODAY} onFillForm={() => undefined} onSave={() => undefined} />);

const calls: string[] = [];
beforeEach(() => {
  window.localStorage.clear(); calls.length = 0; state.connected = true;
  vi.stubGlobal("confirm", vi.fn(() => true));
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { body?: string }) => {
    calls.push(`${url} ${init?.body ?? ""}`);
    return new Response(JSON.stringify({ ok: true, data: { emailedTo: "jordan@example.com", sentOn: TODAY, remindedOn: [] } }), { status: 200 });
  }));
});
afterEach(() => { window.localStorage.clear(); vi.unstubAllGlobals(); });

describe("Packets: emailing and reminders", () => {
  it("emails a packet after asking, records that it was sent, and then offers a reminder", async () => {
    seed(hire());
    view();
    await userEvent.click(screen.getByRole("button", { name: "Email packet to Jordan Cruz" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toContain("/api/packets/send");
    expect(calls[0]).toContain('"id":"p1"');
    expect(await screen.findByRole("status")).toHaveTextContent("Packet emailed to jordan@example.com.");
    expect(saved()[0].sentOn).toBe(TODAY);
    expect(screen.getByRole("button", { name: "Email a reminder to Jordan Cruz" })).toBeInTheDocument();
    expect(screen.getByText(/emailed Nov 20/)).toBeInTheDocument();
  });

  it("sends nothing when the confirm is declined", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    seed(hire());
    view();
    await userEvent.click(screen.getByRole("button", { name: "Email packet to Jordan Cruz" }));
    expect(calls).toHaveLength(0);
    expect(saved()[0].sentOn).toBeUndefined();
  });

  it("shows the server's reason when it cannot send", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: { code: "no_reply_address", message: "Add your business email first." } }), { status: 422 })));
    seed(hire());
    view();
    await userEvent.click(screen.getByRole("button", { name: "Email packet to Jordan Cruz" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Add your business email first.");
    expect(saved()[0].sentOn).toBeUndefined();
  });

  it("is not offered without a connected workspace, without an email, or when nothing of theirs is outstanding", () => {
    state.connected = false;
    seed(hire());
    const a = view();
    expect(screen.queryByRole("button", { name: /Email packet to|Email a reminder to/ })).toBeNull();
    a.unmount();
    state.connected = true;
    seed(hire({ email: "" }));
    const b = view();
    expect(screen.queryByRole("button", { name: /Email packet to/ })).toBeNull();
    b.unmount();
    seed(hire({ items: hire().items.map((i) => (i.by === "us" ? i : { ...i, doneOn: "2026-11-11" })) }));
    view();
    expect(screen.queryByRole("button", { name: /Email packet to/ })).toBeNull();
  });

  it("shows how many reminders went, and flags a person who has gone quiet", () => {
    seed(hire({ sentOn: "2026-11-01", remindedOn: ["2026-11-04", "2026-11-11", "2026-11-18"] }));
    view();
    expect(screen.getByText(/reminded 3 times/)).toBeInTheDocument();
    expect(screen.getByText("No reply after 3 reminders")).toBeInTheDocument();
  });

  it("marks the business's own steps, and offers the new packets", async () => {
    seed(startPacket(PACKETS.find((p) => p.id === "pk-offboard")!, "Jordan Cruz", "jordan@example.com", "2026-11-10", "p2"));
    view();
    expect(screen.getAllByText("(your step)")).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: /Start a packet/ }));
    await userEvent.click(screen.getByRole("combobox", { name: "Packet" }));
    for (const name of ["New hire", "New subcontractor", "Offboarding"]) expect(await screen.findByRole("option", { name })).toBeInTheDocument();
  });
});
