// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
import { WorkspaceCard } from "@/components/control/workspace-card";
import type { ClientRecord } from "@/lib/control/types";

const client: ClientRecord = {
  id: "7a000000-0000-4000-8000-0000000000c1", name: "Acme Roofing", status: "trial", plan: "standard", seatsLimit: 3, ownerName: "Pat Lee", ownerEmail: "pat@acme.com",
  notes: "", workspaceId: "w1", startedOn: null, createdAt: "2026-11-10T00:00:00Z", priceOverrideCents: null, priceNote: "", seatsUsed: 0, lastActive: null, checklist: [],
};

const calls: string[] = [];
let release: (() => void) | null = null;
beforeEach(() => {
  calls.length = 0; release = null;
  vi.stubGlobal("fetch", vi.fn((url: string, init?: { body?: string }) => {
    calls.push(`${url} ${init?.body ?? ""}`.trim());
    const done = () => new Response(JSON.stringify({ ok: true, emailedTo: "pat@acme.com", expiresAt: "2026-12-01T00:00:00Z" }), { status: 200 });
    // The welcome call stays pending until released, so the in-between state can be looked at.
    return url.endsWith("/welcome") ? new Promise((res) => { release = () => res(done()); }) : Promise.resolve(done());
  }));
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
});
afterEach(() => vi.unstubAllGlobals());

const setup = () => render(<WorkspaceCard client={client} plans={[]} unlinked={[]} canEdit />);

describe("WorkspaceCard: invitation and welcome buttons", () => {
  it("Renew invitation only renews the invitation", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Renew invitation/ }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toContain("/workspace");
    expect(calls[0]).toContain('"action":"invite"');
  });

  it("Email welcome message only sends the email", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Email welcome message/ }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toContain("/welcome");
    expect(calls.some((c) => c.includes("/workspace"))).toBe(false);
  });

  it("Copy welcome message only copies: nothing is sent", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Copy welcome message/ }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(0);
  });

  it("while one is running, the others are not greyed out together with it", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Email welcome message|Sending/ }));
    await waitFor(() => expect(calls).toHaveLength(1)); // welcome request is in flight
    const renew = screen.getByRole("button", { name: /Renew invitation/ });
    const copy = screen.getByRole("button", { name: /Copy welcome message/ });
    expect(copy).toBeEnabled();
    expect(renew).toBeDisabled(); // one change at a time, and the screen says why
    expect(screen.getByRole("status")).toHaveTextContent(/sending the welcome email/i);
    release?.();
  });
});

describe("WorkspaceCard: where messages show", () => {
  it("shows the email result right under the buttons, once", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Email welcome message/ }));
    await waitFor(() => expect(calls).toHaveLength(1));
    release?.();
    expect(await screen.findByText(/Welcome email sent to pat@acme.com/)).toBeInTheDocument();
    expect(screen.getAllByText(/Welcome email sent to/)).toHaveLength(1);
  });
  it("Copy says Copied on the button and nothing else changes", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Copy welcome message" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Renew invitation/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Email welcome message/ })).toBeEnabled();
  });
});
