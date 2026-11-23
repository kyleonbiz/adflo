// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { UsagePanel } from "@/components/usage-panel";

const data = {
  plan: "adflo", usage: { aiActions: 120, tokens: 900000, ocrReads: 7, quickActions: 40 },
  seats: { used: 2, limit: 3 }, storage: { usedBytes: 3 * 1_073_741_824, quotaBytes: 20 * 1_073_741_824 },
  limits: { aiActions: 250, ocrPerMonth: 200, tokenBackstop: 3_000_000 },
};
const reply = (status: number, body: unknown) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));

beforeEach(() => reply(200, { ok: true, data }));
afterEach(() => vi.unstubAllGlobals());

describe("UsagePanel", () => {
  it("shows seats, storage, Claude actions and photo reads against the limits", async () => {
    render(<UsagePanel />);
    await waitFor(() => expect(screen.getByText("Your usage")).toBeTruthy());
    expect(screen.getByText("2 of 3")).toBeTruthy();
    expect(screen.getByText("3 of 20")).toBeTruthy();
    expect(screen.getByText("120 of 250")).toBeTruthy();
    expect(screen.getByText("7 of 200")).toBeTruthy();
  });
  it("shows nothing when usage cannot be read (preview or signed out)", async () => {
    reply(404, { ok: false });
    const { container } = render(<UsagePanel />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
});
