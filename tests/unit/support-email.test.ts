import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyQuietly, replyToClientEmail, SUPPORT_FROM } from "@/lib/support/email";

vi.mock("server-only", () => ({}));
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); fetchMock.mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetchMock); vi.stubEnv("RESEND_API_KEY", "test-key"); });
afterEach(() => vi.unstubAllEnvs());

describe("support email", () => {
  it("comes from the support address and replies go back to it, not the reminders address", async () => {
    const m = replyToClientEmail({ ticketNo: 7, subject: "Cannot upload", staffName: "Sam", body: "Send the file", requestUrl: "https://adflo.pro/app/support/t1" });
    await notifyQuietly("alice@client.test", m);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent).toMatchObject({ from: "AdFlo Support <support@adflo.pro>", reply_to: "AdFlo Support <support@adflo.pro>", to: ["alice@client.test"], subject: "Re: [AF-7] Cannot upload" });
    expect(sent.text).toContain("https://adflo.pro/app/support/t1");
  });
  it("SUPPORT_FROM overrides the sender", async () => {
    vi.stubEnv("SUPPORT_FROM", "Help <help@adflo.pro>");
    expect(SUPPORT_FROM()).toBe("Help <help@adflo.pro>");
    await notifyQuietly("a@b.test", { subject: "s", text: "t", html: "<p>t</p>" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe("Help <help@adflo.pro>");
  });
  it("never throws when mail is down or not set up", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    await expect(notifyQuietly("a@b.test", { subject: "s", text: "t", html: "" })).resolves.toBeUndefined();
    vi.unstubAllEnvs();
    await expect(notifyQuietly("a@b.test", { subject: "s", text: "t", html: "" })).resolves.toBeUndefined();
    await expect(notifyQuietly("", { subject: "s", text: "t", html: "" })).resolves.toBeUndefined();
  });
});
