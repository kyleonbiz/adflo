import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTO_REMIND_MAX, autoRemindDays, autoRemindEnabled, dueAutoReminders, type AutoInput } from "@/lib/control/auto-reminders";

const now = new Date("2026-11-20T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

const input = (over: Partial<AutoInput> = {}): AutoInput => ({
  clients: [{ id: "c1", status: "active", ownerEmail: "pat@acme.com", workspaceId: "w1" }],
  members: {},
  welcomeAt: { c1: daysAgo(4) },
  waiting: [],
  reminders: [],
  ...over,
});

describe("dueAutoReminders", () => {
  it("reminds an owner who has not signed up 3+ days after the welcome", () => {
    expect(dueAutoReminders(input(), now)).toEqual([{ clientId: "c1", kind: "signup" }]);
  });
  it("waits until 3 days have passed", () => {
    expect(dueAutoReminders(input({ welcomeAt: { c1: daysAgo(2) } }), now)).toEqual([]);
  });
  it("counts from the last reminder, not only the welcome", () => {
    expect(dueAutoReminders(input({ reminders: [{ clientId: "c1", sentAt: daysAgo(1), auto: false }] }), now)).toEqual([]);
    expect(dueAutoReminders(input({ reminders: [{ clientId: "c1", sentAt: daysAgo(3), auto: true }] }), now)).toHaveLength(1);
  });
  it("reminds about an agreement left unaccepted once the owner has joined", () => {
    const i = input({ members: { w1: 2 }, waiting: [{ clientId: "c1", sentAt: daysAgo(5) }] });
    expect(dueAutoReminders(i, now)).toEqual([{ clientId: "c1", kind: "agreement" }]);
    expect(dueAutoReminders({ ...i, waiting: [{ clientId: "c1", sentAt: daysAgo(1) }] }, now)).toEqual([]);
  });
  it("leaves alone a client nobody has contacted about the step, or with nothing outstanding", () => {
    expect(dueAutoReminders(input({ welcomeAt: {} }), now)).toEqual([]);
    expect(dueAutoReminders(input({ members: { w1: 1 } }), now)).toEqual([]);
    expect(dueAutoReminders(input({ clients: [{ id: "c1", status: "active", ownerEmail: "", workspaceId: "w1" }] }), now)).toEqual([]);
    expect(dueAutoReminders(input({ clients: [{ id: "c1", status: "cancelled", ownerEmail: "pat@acme.com", workspaceId: "w1" }] }), now)).toEqual([]);
  });
  it("stops after the maximum number of automatic reminders, but not because of manual ones", () => {
    const auto = Array.from({ length: AUTO_REMIND_MAX }, (_, i) => ({ clientId: "c1", sentAt: daysAgo(10 + i), auto: true }));
    expect(dueAutoReminders(input({ reminders: auto }), now)).toEqual([]);
    const manual = Array.from({ length: AUTO_REMIND_MAX }, (_, i) => ({ clientId: "c1", sentAt: daysAgo(10 + i), auto: false }));
    expect(dueAutoReminders(input({ reminders: manual }), now)).toHaveLength(1);
  });
});

describe("settings", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("defaults to 3 days, on, and accepts a sensible override", () => {
    expect(autoRemindDays({})).toBe(3);
    expect(autoRemindDays({ ONBOARDING_REMIND_AFTER_DAYS: "5" })).toBe(5);
    expect(autoRemindDays({ ONBOARDING_REMIND_AFTER_DAYS: "0" })).toBe(3);
    expect(autoRemindDays({ ONBOARDING_REMIND_AFTER_DAYS: "abc" })).toBe(3);
    expect(autoRemindEnabled({})).toBe(true);
    expect(autoRemindEnabled({ ONBOARDING_AUTO_REMIND: "off" })).toBe(false);
  });
});
