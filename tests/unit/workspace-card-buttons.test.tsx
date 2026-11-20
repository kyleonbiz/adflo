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
    const done = () => new Response(JSON.stringify({ ok: true, emailedTo: "pat@acme.com", link: "https://www.adflo.pro/invite/test-link", expiresAt: "2026-12-01T00:00:00Z" }), { status: 200 });
    // The welcome call stays pending until released, so the in-between state can be looked at.
    return url.endsWith("/welcome") || url.endsWith("/invitation") ? new Promise((res) => { release = () => res(done()); }) : Promise.resolve(done());
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

  it("Email invitation only sends the invitation email", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Email invitation/ }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toContain("/invitation");
    expect(calls.some((c) => c.includes("/workspace") || c.includes("/welcome"))).toBe(false);
  });

  it("the welcome message is switched off until the owner has joined, and is its own email once they have", async () => {
    const { unmount } = setup();
    expect(screen.getByRole("button", { name: /Email welcome message/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Copy welcome message/ })).toBeDisabled();
    unmount();
    render(<WorkspaceCard client={{ ...client, seatsUsed: 1 }} plans={[]} unlinked={[]} canEdit />);
    expect(screen.queryByRole("button", { name: /Email invitation|Renew invitation|Copy invitation/ })).toBeNull(); // nothing left to invite
    await userEvent.click(screen.getByRole("button", { name: /Email welcome message/ }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toContain("/welcome");
  });

  it("Copy invitation makes a fresh confirm link and copies it: nothing is emailed", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Copy invitation/ }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/invite-link");
    expect(calls.some((c) => c.includes("/welcome") || c.includes("/invitation"))).toBe(false);
    expect(vi.mocked(navigator.clipboard.writeText).mock.calls[0][0]).toContain("https://www.adflo.pro/invite/test-link");
  });

  it("while one is running, the others are not greyed out together with it", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Email invitation|Sending/ }));
    await waitFor(() => expect(calls).toHaveLength(1)); // the invitation request is in flight
    const renew = screen.getByRole("button", { name: /Renew invitation/ });
    const copy = screen.getByRole("button", { name: /Copy invitation/ });
    expect(copy).toBeEnabled();
    expect(renew).toBeDisabled(); // one change at a time, and the screen says why
    expect(screen.getByRole("status")).toHaveTextContent(/sending the invitation email/i);
    release?.();
  });
});

describe("WorkspaceCard: where messages show", () => {
  it("shows the email result right under the buttons, once", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Email invitation/ }));
    await waitFor(() => expect(calls).toHaveLength(1));
    release?.();
    expect(await screen.findByText(/Invitation email sent to pat@acme.com/)).toBeInTheDocument();
    expect(screen.getAllByText(/Invitation email sent to/)).toHaveLength(1);
  });
  it("Copy says Copied on the button and nothing else changes", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Copy invitation" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Copied" })).toHaveLength(1); // only the one that was copied says so
    expect(screen.getByRole("button", { name: /Renew invitation/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Email invitation/ })).toBeEnabled();
  });
});

describe("WorkspaceCard: remind the owner about a pending invitation", () => {
  const remind = () => screen.getByRole("button", { name: /Remind the owner about their invitation/ });

  it("sends the signup reminder (and nothing else) and says who it went to", async () => {
    setup();
    await userEvent.click(remind());
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toContain("/remind");
    expect(calls[0]).toContain('"kind":"signup"');
    expect(await screen.findByText(/Reminder sent to pat@acme.com/)).toBeInTheDocument();
  });

  it("says when they were last reminded, and waits out the daily limit", () => {
    const recent = new Date(Date.now() - 2 * 3_600_000).toISOString();
    render(<WorkspaceCard client={{ ...client, lastReminderAt: recent }} plans={[]} unlinked={[]} canEdit />);
    expect(remind()).toBeDisabled();
    expect(screen.getByText(/Last reminded today/)).toBeInTheDocument();
    expect(screen.getByText(/remind them again in about 22 hours/)).toBeInTheDocument();
  });

  it("can be used again a day later", () => {
    const old = new Date(Date.now() - 3 * 86_400_000).toISOString();
    render(<WorkspaceCard client={{ ...client, lastReminderAt: old }} plans={[]} unlinked={[]} canEdit />);
    expect(remind()).toBeEnabled();
    expect(screen.getByText(/Last reminded 3 days ago/)).toBeInTheDocument();
  });

  it("is not offered once the owner has joined, or to read-only staff", () => {
    const { unmount } = render(<WorkspaceCard client={{ ...client, seatsUsed: 1 }} plans={[]} unlinked={[]} canEdit />);
    expect(screen.queryByRole("button", { name: /Remind the owner/ })).toBeNull();
    unmount();
    render(<WorkspaceCard client={client} plans={[]} unlinked={[]} canEdit={false} />);
    expect(screen.queryByRole("button", { name: /Remind the owner/ })).toBeNull();
  });
});
