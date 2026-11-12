// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Rec } from "@/lib/records/diff";
import { RecordsSyncError, configureRemote, refreshRemote, remoteActive, remoteLoading, remoteProblem, retryRemote, stopRemote, type RecordsBackend } from "@/lib/records/remote";
import { clearRecords, parseRecords, readRaw, writeRecords } from "@/lib/records/storage";
import { clearAllRecords, loadSample } from "@/lib/samples/storage";

interface Fake extends RecordsBackend { db: Map<string, Rec[] | null>; saves: { kind: string; upserts: Rec[]; deletes: string[]; markSaved: boolean }[]; failLoad: boolean; failSave: "failed" | "denied" | null }

/** A backend that keeps its "database" in memory, so the tests can see exactly what was sent. */
function fake(initial: Record<string, Rec[] | null> = {}): Fake {
  const f: Fake = {
    db: new Map(Object.entries(initial)), saves: [], failLoad: false, failSave: null,
    async load(kind) {
      if (f.failLoad) throw new RecordsSyncError("failed");
      const rows = f.db.get(kind) ?? null;
      return { records: rows ?? [], saved: rows !== null };
    },
    async save(kind, change) {
      if (f.failSave) throw new RecordsSyncError(f.failSave);
      f.saves.push({ kind, ...change });
      const rows = new Map((f.db.get(kind) ?? []).map((r) => [r.id, r]));
      for (const r of change.upserts) rows.set(r.id, r);
      for (const id of change.deletes) rows.delete(id);
      f.db.set(kind, [...rows.values()]);
    },
  };
  return f;
}

const lic = (id: string, name = id): Rec => ({ id, name });
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); };
const start = async (f: Fake, key = "ws-1") => { configureRemote(key, () => f, ["licenses", "projects"]); await settle(); };

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { stopRemote(); vi.useRealTimers(); });

describe("loading", () => {
  it("shows nothing until the database answers, then the saved records", async () => {
    const f = fake({ licenses: [lic("l1")], projects: null });
    configureRemote("ws-1", () => f, ["licenses", "projects"]);
    expect(remoteLoading()).toBe(true);
    expect(readRaw("licenses")).toBe("");
    await settle();
    expect(remoteLoading()).toBe(false);
    expect(parseRecords<Rec>(readRaw("licenses"))).toEqual([lic("l1")]);
  });
  it("tells never-saved (null: starter records may show) from saved-then-emptied ([])", async () => {
    await start(fake({ licenses: [], projects: null }));
    expect(parseRecords(readRaw("licenses"))).toEqual([]);
    expect(parseRecords(readRaw("projects"))).toBeNull();
  });
  it("is a no-op to connect twice for the same workspace, and reconnects for another", async () => {
    const f = fake({ licenses: [lic("l1")] });
    const make = vi.fn(() => f);
    configureRemote("ws-1", make, ["licenses"]);
    configureRemote("ws-1", make, ["licenses"]);
    expect(make).toHaveBeenCalledTimes(1);
    await settle();
    configureRemote("ws-2", make, ["licenses"]);
    expect(make).toHaveBeenCalledTimes(2);
  });
  it("leaves services that are not database-backed in the browser", async () => {
    await start(fake({ licenses: [] }));
    writeRecords("invoices", [{ id: "i1" }]);
    expect(window.localStorage.getItem("adflo.records.invoices.v1")).toContain("i1");
    expect(window.localStorage.getItem("adflo.records.licenses.v1")).toBeNull();
  });
});

describe("saving", () => {
  it("shows a change at once and sends only what changed", async () => {
    const f = fake({ licenses: [lic("l1"), lic("l2")] });
    await start(f);
    writeRecords("licenses", [lic("l1"), lic("l2", "renamed"), lic("l3")]);
    expect(parseRecords<Rec>(readRaw("licenses"))!.map((r) => r.id)).toEqual(["l1", "l2", "l3"]); // before the database answered
    await settle();
    expect(f.saves).toEqual([{ kind: "licenses", upserts: [lic("l2", "renamed"), lic("l3")], deletes: [], markSaved: false }]);
  });
  it("sends deletes, and does not resend an unchanged list", async () => {
    const f = fake({ licenses: [lic("l1"), lic("l2")] });
    await start(f);
    writeRecords("licenses", [lic("l2")]);
    await settle();
    expect(f.saves[0]).toMatchObject({ upserts: [], deletes: ["l1"] });
    writeRecords("licenses", [lic("l2")]);
    await settle();
    expect(f.saves).toHaveLength(1);
  });
  it("marks a never-saved service as saved with its first write, even an empty one", async () => {
    const f = fake({ licenses: null });
    await start(f);
    writeRecords("licenses", []); // e.g. the owner deleted every starter record
    await settle();
    expect(f.saves).toEqual([{ kind: "licenses", upserts: [], deletes: [], markSaved: true }]);
    writeRecords("licenses", [lic("a")]);
    await settle();
    expect(f.saves[1]).toMatchObject({ markSaved: false });
  });
  it("coalesces quick edits into the final state", async () => {
    const f = fake({ licenses: [] });
    await start(f);
    writeRecords("licenses", [lic("a")]);
    writeRecords("licenses", [lic("a"), lic("b")]);
    writeRecords("licenses", [lic("a"), lic("b"), lic("c")]);
    await settle();
    expect(f.db.get("licenses")!.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(f.saves.flatMap((s) => s.upserts).length).toBeLessThanOrEqual(3 + 2 + 1);
  });
  it("ignores clearRecords for database-backed services (a helper can never wipe them)", async () => {
    const f = fake({ licenses: [lic("l1")] });
    await start(f);
    clearRecords("licenses");
    await settle();
    expect(parseRecords<Rec>(readRaw("licenses"))).toEqual([lic("l1")]);
    expect(f.saves).toEqual([]);
  });
  it("keeps sample data out of a real workspace", async () => {
    const f = fake({ licenses: [lic("l1")], projects: [] });
    await start(f);
    expect(remoteActive()).toBe(true);
    loadSample("small", "2026-11-12");
    clearAllRecords();
    await settle();
    expect(parseRecords<Rec>(readRaw("licenses"))).toEqual([lic("l1")]);
    expect(f.saves).toEqual([]);
  });
});

describe("problems", () => {
  it("keeps your change and retries when a save fails", async () => {
    vi.useFakeTimers();
    const f = fake({ licenses: [] });
    configureRemote("ws-1", () => f, ["licenses"]);
    await vi.advanceTimersByTimeAsync(0);
    f.failSave = "failed";
    writeRecords("licenses", [lic("a")]);
    await vi.advanceTimersByTimeAsync(0);
    expect(remoteProblem()).toEqual({ problem: "failed", loading: false });
    expect(parseRecords<Rec>(readRaw("licenses"))).toEqual([lic("a")]); // still shown
    f.failSave = null;
    await vi.advanceTimersByTimeAsync(9000); // the automatic retry
    expect(remoteProblem()).toBeNull();
    expect(f.db.get("licenses")).toEqual([lic("a")]);
  });
  it("can be retried by hand", async () => {
    const f = fake({ licenses: [] });
    await start(f);
    f.failSave = "failed";
    writeRecords("licenses", [lic("a")]);
    await settle();
    f.failSave = null;
    retryRemote();
    await settle();
    expect(f.db.get("licenses")).toEqual([lic("a")]);
  });
  it("puts a refused change back (a viewer cannot edit) and says why", async () => {
    const f = fake({ licenses: [lic("l1")] });
    await start(f);
    f.failSave = "denied";
    writeRecords("licenses", [lic("l1", "edited")]);
    await settle();
    expect(remoteProblem()).toEqual({ problem: "denied", loading: false });
    expect(parseRecords<Rec>(readRaw("licenses"))).toEqual([lic("l1")]);
  });
  it("never edits on top of records it could not load", async () => {
    vi.useFakeTimers();
    const f = fake({ licenses: [lic("l1")] });
    f.failLoad = true;
    configureRemote("ws-1", () => f, ["licenses"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(remoteLoading()).toBe(true);
    expect(remoteProblem()).toEqual({ problem: "failed", loading: true });
    writeRecords("licenses", [lic("oops")]); // would overwrite real records if it were accepted
    await vi.advanceTimersByTimeAsync(0);
    expect(f.saves).toEqual([]);
    f.failLoad = false;
    await vi.advanceTimersByTimeAsync(9000);
    expect(remoteLoading()).toBe(false);
    expect(parseRecords<Rec>(readRaw("licenses"))).toEqual([lic("l1")]);
  });
});

describe("other people's changes", () => {
  it("are picked up when the tab is shown again", async () => {
    const f = fake({ licenses: [lic("l1")] });
    await start(f);
    f.db.set("licenses", [lic("l1"), lic("l2")]); // a teammate added one
    await refreshRemote();
    expect(parseRecords<Rec>(readRaw("licenses"))!.map((r) => r.id)).toEqual(["l1", "l2"]);
  });
  it("never overwrite a change of yours that has not been saved yet", async () => {
    const f = fake({ licenses: [lic("l1")] });
    await start(f);
    f.failSave = "failed";
    writeRecords("licenses", [lic("l1", "mine")]);
    await settle();
    f.db.set("licenses", [lic("l1", "theirs")]);
    await refreshRemote();
    expect(parseRecords<Rec>(readRaw("licenses"))).toEqual([lic("l1", "mine")]);
  });
});
