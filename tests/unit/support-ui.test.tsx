// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SupportCenter } from "@/components/support/support-center";
import { RequestThread } from "@/components/support/request-thread";
import type { MyTicket, MyTicketDetail } from "@/lib/support/types";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const t = (o: Partial<MyTicket>): MyTicket => ({ id: "t1", ticketNo: 7, subject: "Cannot upload", category: "problem", status: "open", createdAt: "2026-11-20T10:00:00Z", lastActivity: "2026-11-21T10:00:00Z", requesterName: "Alice", ...o });
const detail = (o: Partial<MyTicketDetail> = {}): MyTicketDetail => ({
  id: "t1", ticketNo: 7, subject: "Cannot upload", body: "The PDF fails", category: "problem", status: "pending", source: "client", createdAt: "2026-11-20T10:00:00Z", requesterName: "Alice",
  messages: [{ id: "m1", authorKind: "staff", authorName: "Sam", body: "Can you send the file?", createdAt: "2026-11-21T10:00:00Z" }], ...o,
});
const fetchMock = vi.fn();
beforeEach(() => { push.mockReset(); refresh.mockReset(); fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
const ok = (body: unknown = { ok: true }, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body });

describe("SupportCenter", () => {
  it("lists active requests with their number and says when one waits on the client", () => {
    render(<SupportCenter tickets={[t({}), t({ id: "t2", ticketNo: 8, subject: "Add a seat", status: "pending" }), t({ id: "t3", ticketNo: 9, subject: "Old one", status: "closed" })]} />);
    expect(screen.getByRole("link", { name: /Cannot upload/ })).toHaveAttribute("href", "/app/support/t1");
    expect(screen.getByText("AF-8")).toBeInTheDocument();
    expect(screen.getByText("1 request is waiting on you.")).toBeInTheDocument();
    expect(screen.queryByText("Old one")).toBeNull();
  });
  it("shows closed requests on their own tab", async () => {
    render(<SupportCenter tickets={[t({}), t({ id: "t3", subject: "Old one", status: "closed" })]} />);
    await userEvent.click(screen.getByRole("button", { name: "Closed 1" }));
    expect(screen.getByText("Old one")).toBeInTheDocument();
    expect(screen.queryByText("Cannot upload")).toBeNull();
  });
  it("invites a first request when there are none", () => {
    render(<SupportCenter tickets={[]} />);
    expect(screen.getByText("No requests yet")).toBeInTheDocument();
  });
  it("sends a new request and opens it", async () => {
    fetchMock.mockReturnValue(ok({ ok: true, id: "new-id" }, 201));
    render(<SupportCenter tickets={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "New request" }));
    await userEvent.click(screen.getByLabelText(/Something is broken/));
    await userEvent.type(screen.getByLabelText("Subject"), "Cannot upload");
    await userEvent.type(screen.getByLabelText("What is going on?"), "The PDF fails");
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/support/new-id"));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ category: "problem", subject: "Cannot upload", body: "The PDF fails" });
  });
  it("shows field errors from the server and stays open", async () => {
    fetchMock.mockReturnValue(ok({ ok: false, error: { message: "Check", fields: { subject: "Add a short subject (up to 200 characters)." } } }, 400));
    render(<SupportCenter tickets={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "New request" }));
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText(/Add a short subject/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("RequestThread", () => {
  it("shows the request first, then replies, and says it is waiting on the client", () => {
    render(<RequestThread ticket={detail()} />);
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toContain("The PDF fails");
    expect(items[1]).toContain("Can you send the file?");
    expect(items[1]).toContain("AdFlo Support");
    expect(screen.getByText("AdFlo Support is waiting on your reply.")).toBeInTheDocument();
  });
  it("shows a request AdFlo opened as AdFlo's own, not the client's", () => {
    render(<RequestThread ticket={detail({ source: "staff", requesterName: "AdFlo Support", body: "We spotted a problem with your plan" })} />);
    const first = screen.getAllByRole("listitem")[0];
    expect(first).toHaveTextContent("We spotted a problem with your plan");
    expect(first.textContent).toMatch(/^AdFlo Support ·/);
    expect(first.textContent).not.toContain("AdFlo Support · AdFlo Support");
  });
  it("sends a reply and refreshes", async () => {
    fetchMock.mockReturnValue(ok({ ok: true }, 201));
    render(<RequestThread ticket={detail()} />);
    expect(screen.getByRole("button", { name: "Send reply" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Your reply"), "Attached");
    await userEvent.click(screen.getByRole("button", { name: "Send reply" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/support/tickets/t1/messages");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ body: "Attached" });
  });
  it("marks as solved, and offers to reopen a closed request", async () => {
    fetchMock.mockReturnValue(ok());
    const { rerender } = render(<RequestThread ticket={detail({ status: "open" })} />);
    await userEvent.click(screen.getByRole("button", { name: "Mark as solved" }));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/support/tickets/t1");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ closed: true });
    rerender(<RequestThread ticket={detail({ status: "closed" })} />);
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
    expect(screen.getByText(/Replying will reopen it/)).toBeInTheDocument();
  });
  it("shows the server's message when sending fails", async () => {
    fetchMock.mockReturnValue(ok({ ok: false, error: { message: "That is a lot of requests in a short time." } }, 429));
    render(<RequestThread ticket={detail()} />);
    await userEvent.type(screen.getByLabelText("Your reply"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Send reply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("a lot of requests");
  });
});
