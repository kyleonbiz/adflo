import { describe, expect, it } from "vitest";
import { PACKETS, STALE_PACKET_DAYS, isComplete, isStale, packetText, parseAssignments, progress, startPacket, startProblem, toggleItem } from "@/lib/packets/logic";
import { PAPERWORK } from "@/lib/forms/paperwork";
import { addDays } from "@/lib/dates";

const T = "2026-10-26";

describe("onboarding packets", () => {
  it("only point at forms that exist in the paperwork library", () => {
    const ids = new Set(PAPERWORK.map((p) => p.form.id));
    for (const p of PACKETS) {
      expect(new Set(p.items.map((i) => i.id)).size).toBe(p.items.length);
      for (const i of p.items) if (i.kind === "form") expect(ids.has(i.formId!)).toBe(true);
    }
  });

  it("starts empty, ticks items off and back, and reports progress", () => {
    const a = startPacket(PACKETS[0], " Sam Ito ", "sam@example.com", T, "a1");
    expect(a.recipient).toBe("Sam Ito");
    expect(progress(a)).toEqual({ done: 0, total: 6, percent: 0 });
    const one = toggleItem(a, "e1", T);
    expect(progress(one).done).toBe(1);
    expect(toggleItem(one, "e1", T).items[0].doneOn).toBeNull();
    let all = a;
    for (const i of a.items) all = toggleItem(all, i.id, T);
    expect(isComplete(all)).toBe(true);
    expect(progress(all).percent).toBe(100);
  });

  it("flags a packet that has sat unfinished for a week, but not a finished one", () => {
    const old = startPacket(PACKETS[1], "Acme", "", addDays(T, -STALE_PACKET_DAYS), "a2");
    expect(isStale(old, T)).toBe(true);
    expect(isStale(startPacket(PACKETS[1], "Acme", "", addDays(T, -2), "a3"), T)).toBe(false);
    let done = old;
    for (const i of old.items) done = toggleItem(done, i.id, T);
    expect(isStale(done, T)).toBe(false);
  });

  it("validates who it is for, and writes a printable checklist", () => {
    expect(startProblem("A", "")).not.toBeNull();
    expect(startProblem("Sam Ito", "nope")).not.toBeNull();
    expect(startProblem("Sam Ito", "")).toBeNull();
    const text = packetText(toggleItem(startPacket(PACKETS[2], "Globex", "ap@globex.example", T, "a4"), "c1", T));
    expect(text).toContain("NEW CLIENT PACKET");
    expect(text).toContain("[x] Fill out: Client intake");
    expect(text).toContain("[ ] Signature: Service agreement");
  });

  it("reads saved packets defensively", () => {
    expect(parseAssignments("nope")).toEqual([]);
    expect(parseAssignments(JSON.stringify([{ id: 1 }, startPacket(PACKETS[0], "Sam Ito", "", T, "a5")]))).toHaveLength(1);
  });
});
