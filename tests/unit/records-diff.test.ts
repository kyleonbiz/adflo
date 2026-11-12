import { describe, expect, it } from "vitest";
import { diffRecords, sameRecords } from "@/lib/records/diff";

const a = { id: "a", name: "A" };
const b = { id: "b", name: "B" };

describe("diffRecords", () => {
  it("saves everything when nothing was saved before", () => {
    expect(diffRecords(null, [a, b])).toEqual({ upserts: [a, b], deletes: [] });
  });
  it("saves nothing when nothing changed", () => {
    expect(diffRecords([a, b], [{ ...a }, { ...b }])).toEqual({ upserts: [], deletes: [] });
  });
  it("saves only the records that are new or changed", () => {
    const c = { id: "c", name: "C" };
    expect(diffRecords([a, b], [a, { ...b, name: "B2" }, c])).toEqual({ upserts: [{ id: "b", name: "B2" }, c], deletes: [] });
  });
  it("deletes the records that are gone", () => {
    expect(diffRecords([a, b], [b])).toEqual({ upserts: [], deletes: ["a"] });
    expect(diffRecords([a, b], [])).toEqual({ upserts: [], deletes: ["a", "b"] });
  });
  it("sees a change deep inside a record, such as a task being ticked", () => {
    const p1 = { id: "p", tasks: [{ id: "t", done: false }] };
    const p2 = { id: "p", tasks: [{ id: "t", done: true }] };
    expect(diffRecords([p1], [p2]).upserts).toEqual([p2]);
  });
  it("skips records with no usable id instead of failing", () => {
    expect(diffRecords([], [{ name: "x" }, { id: "" }, { id: 5 }, { id: "x".repeat(81) }, null, a])).toEqual({ upserts: [a], deletes: [] });
  });
});

describe("sameRecords", () => {
  it("compares by content, and treats never-saved (null) as different from empty", () => {
    expect(sameRecords([a], [{ ...a }])).toBe(true);
    expect(sameRecords([a], [b])).toBe(false);
    expect(sameRecords(null, null)).toBe(true);
    expect(sameRecords(null, [])).toBe(false);
  });
});
