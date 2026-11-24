// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const state = vi.hoisted(() => ({ connected: true }));
vi.mock("@/lib/records/storage", async (orig) => ({ ...(await orig<typeof import("@/lib/records/storage")>()), useRecordsInDatabase: () => state.connected }));

import { CalendarFeedCard } from "@/components/calendar/calendar-feed-card";

const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
let on = false;
beforeEach(() => {
  state.connected = true; on = false;
  vi.stubGlobal("fetch", vi.fn(async (_u: string, init: { method: string }) => {
    if (init.method === "GET") return reply({ ok: true, data: { on } });
    if (init.method === "POST") { on = true; return reply({ ok: true, data: { url: "https://adflo.pro/api/calendar/feed/abc.ics" } }); }
    on = false; return reply({ ok: true, data: {} });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("CalendarFeedCard", () => {
  it("is not shown in the preview", () => {
    state.connected = false;
    const { container } = render(<CalendarFeedCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("makes the link, shows it once with the privacy note, then offers replace and turn off", async () => {
    render(<CalendarFeedCard />);
    await userEvent.click(await screen.findByRole("button", { name: "Get my calendar link" }));
    expect(await screen.findByLabelText("Calendar link")).toHaveValue("https://adflo.pro/api/calendar/feed/abc.ics");
    expect(screen.getByText(/Anyone with the link can read the titles/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace the link" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Turn off" }));
    expect(await screen.findByRole("button", { name: "Get my calendar link" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Calendar link")).toBeNull();
  });

  it("shows a refusal in words", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: { method: string }) => init.method === "GET" ? reply({ ok: true, data: { on: false } }) : reply({ ok: false, error: { message: "Only an owner or admin can make the calendar link." } }, 403)));
    render(<CalendarFeedCard />);
    await userEvent.click(await screen.findByRole("button", { name: "Get my calendar link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only an owner or admin");
  });
});
