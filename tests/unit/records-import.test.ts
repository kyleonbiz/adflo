// @vitest-environment jsdom
// "Import from this browser": brings records that a browser still holds into a connected workspace, only when asked,
// never overwriting what the workspace has, never importing the built-in sample records.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Rec } from "@/lib/records/diff";
import {
  MAX_RECORD_BYTES, SERVICES, findBrowserCopies, importFromBrowser, parseBrowserCopy, planMerge, removeBrowserCopies,
} from "@/lib/records/import";
import { RecordsSyncError, configureRemote, stopRemote, type RecordsBackend } from "@/lib/records/remote";
import { SINGLE_ID, readSingleRaw, readRaw } from "@/lib/records/storage";

const svc = (kind: string) => SERVICES.find((s) => s.kind === kind)!;
const put = (key: string, value: unknown) => window.localStorage.setItem(key, JSON.stringify(value));

type Save = { kind: string; upserts: Rec[]; deletes: string[] };
function fakeDb(initial: Record<string, Rec[]> = {}, mode: "ok" | "denied" | "down" = "ok") {
  const rows = new Map<string, Rec[]>(Object.entries(initial));
  const saves: Save[] = [];
  const backend: RecordsBackend = {
    async load(kind) { const r = rows.get(kind); return { records: r ?? [], saved: !!r }; },
    async save(kind, change) {
      if (mode === "denied") throw new RecordsSyncError("denied");
      if (mode === "down") throw new Error("down");
      saves.push({ kind, upserts: change.upserts, deletes: change.deletes });
      const map = new Map((rows.get(kind) ?? []).map((r) => [r.id, r]));
      for (const r of change.upserts) map.set(r.id, r);
      for (const id of change.deletes) map.delete(id);
      rows.set(kind, [...map.values()]);
    },
  };
  return { backend, saves, rows };
}
const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const connect = async (db: ReturnType<typeof fakeDb>, kinds: Parameters<typeof configureRemote>[2]) => { configureRemote("ws-1", () => db.backend, kinds); await tick(); };

beforeEach(() => window.localStorage.clear());
afterEach(() => stopRemote());

describe("reading what a browser holds", () => {
  it("separates records to import from sample records, oversized ones and things that are not records", () => {
    const big = { id: "big-1", notes: "x".repeat(MAX_RECORD_BYTES + 10) };
    const raw = JSON.stringify([
      { id: "lic-1", name: "Mine" }, { id: "lic-2", name: "Also mine" },
      { id: "demo-lic-1", name: "Sample" }, { id: "demo-lic-2", name: "Sample 2" },
      big, { name: "no id" }, { id: "" }, { id: "x".repeat(81) }, "text", null, 7,
    ]);
    const copy = parseBrowserCopy(svc("licenses"), raw)!;
    expect(copy.usable.map((r) => r.id)).toEqual(["lic-1", "lic-2"]);
    expect(copy.sample).toBe(2);
    expect(copy.tooLarge).toBe(1);
  });

  it("finds nothing in an empty, unreadable or wrongly shaped copy", () => {
    expect(parseBrowserCopy(svc("licenses"), "")).toBeNull();
    expect(parseBrowserCopy(svc("licenses"), "{not json")).toBeNull();
    expect(parseBrowserCopy(svc("licenses"), JSON.stringify({ an: "object" }))).toBeNull();
    expect(parseBrowserCopy(svc("licenses"), "[]")).toBeNull();
    expect(parseBrowserCopy(svc("settings"), "[1,2]")).toBeNull();
    expect(parseBrowserCopy(svc("settings"), "{}")).toBeNull();
  });

  it("a single-object service is one record with the fixed id", () => {
    const copy = parseBrowserCopy(svc("settings"), JSON.stringify({ version: 1, details: { email: "a@b.co" } }))!;
    expect(copy.usable).toEqual([{ version: 1, details: { email: "a@b.co" }, id: SINGLE_ID }]);
  });

  it("reads each service from the key it has always used", () => {
    put("adflo.records.invoices.v1", [{ id: "inv-1" }]);
    put("adflo.todos.v1", [{ id: "t-1" }]);
    put("aurum.setup.v1", { business: { name: "Harbor" } });
    expect(findBrowserCopies().map((c) => c.service.kind).sort()).toEqual(["invoices", "setup", "todos"]);
  });
});

describe("what would be added", () => {
  it("adds only what the workspace does not have, and keeps what it has exactly as it is", () => {
    const copy = parseBrowserCopy(svc("vendors"), JSON.stringify([{ id: "v1", name: "Local name" }, { id: "v2", name: "New" }]))!;
    const plan = planMerge(copy, [{ id: "v1", name: "Workspace name" }, { id: "v9", name: "Other" }]);
    expect(plan.add).toBe(1);
    expect(plan.alreadyThere).toBe(1);
    expect(plan.next).toEqual([{ id: "v1", name: "Workspace name" }, { id: "v9", name: "Other" }, { id: "v2", name: "New" }]);
  });

  it("everything is new in a workspace that has nothing yet", () => {
    const copy = parseBrowserCopy(svc("vendors"), JSON.stringify([{ id: "v1" }, { id: "v2" }]))!;
    expect(planMerge(copy, null)).toMatchObject({ add: 2, alreadyThere: 0 });
  });

  it("a single-object service is never replaced once the workspace has one", () => {
    const copy = parseBrowserCopy(svc("settings"), JSON.stringify({ version: 1 }))!;
    expect(planMerge(copy, [{ id: SINGLE_ID, version: 1, mine: true }])).toMatchObject({ add: 0, alreadyThere: 1 });
    expect(planMerge(copy, null)).toMatchObject({ add: 1, alreadyThere: 0 });
  });
});

describe("importing into a connected workspace", () => {
  it("adds the new records to the database, leaves existing ones alone, and says what happened", async () => {
    put("adflo.records.vendors.v1", [{ id: "v1", name: "Local copy" }, { id: "v2", name: "New one" }, { id: "demo-v-1", name: "Sample vendor" }]);
    const db = fakeDb({ vendors: [{ id: "v1", name: "Workspace copy" }] });
    await connect(db, ["vendors"]);
    const [report] = await importFromBrowser(["vendors"]);
    expect(report).toMatchObject({ added: 1, alreadyThere: 1, sample: 1, tooLarge: 0, problem: null });
    expect(db.saves).toHaveLength(1);
    expect(db.saves[0]!.upserts.map((r) => r.id)).toEqual(["v2"]);
    expect(db.saves[0]!.deletes).toEqual([]);
    expect(JSON.parse(readRaw("vendors"))).toEqual([{ id: "v1", name: "Workspace copy" }, { id: "v2", name: "New one" }]);
    expect(db.rows.get("vendors")!.some((r) => r.id === "demo-v-1")).toBe(false); // sample records never reach the workspace
  });

  it("imports a single-object service only into a workspace that has none, and never over one", async () => {
    put("adflo.settings.v1", { version: 1, details: { email: "browser@example.com" } });
    put("aurum.setup.v1", { business: { name: "Browser Co" } });
    const db = fakeDb({ setup: [{ business: { name: "Workspace Co" }, id: SINGLE_ID }] });
    await connect(db, ["settings", "setup"]);
    const reports = await importFromBrowser(["settings", "setup"]);
    expect(reports.find((r) => r.service.kind === "settings")).toMatchObject({ added: 1, problem: null });
    expect(reports.find((r) => r.service.kind === "setup")).toMatchObject({ added: 0, alreadyThere: 1 });
    expect(JSON.parse(readSingleRaw("settings")).details.email).toBe("browser@example.com");
    expect(JSON.parse(readSingleRaw("setup")).business.name).toBe("Workspace Co");
  });

  it("only touches the services it was asked to", async () => {
    put("adflo.todos.v1", [{ id: "t-1" }]);
    put("adflo.reminders.v1", [{ id: "r-1" }]);
    const db = fakeDb();
    await connect(db, ["todos", "reminders"]);
    await importFromBrowser(["todos"]);
    expect(db.saves.map((s) => s.kind)).toEqual(["todos"]);
  });

  it("leaves out a record that is too large rather than retrying it for ever", async () => {
    put("adflo.todos.v1", [{ id: "ok" }, { id: "huge", text: "x".repeat(MAX_RECORD_BYTES + 5) }]);
    const db = fakeDb();
    await connect(db, ["todos"]);
    const [report] = await importFromBrowser(["todos"]);
    expect(report).toMatchObject({ added: 1, tooLarge: 1, problem: null });
    expect(db.saves[0]!.upserts.map((r) => r.id)).toEqual(["ok"]);
  });

  it("reports a refusal, and shows only what the workspace really holds", async () => {
    put("adflo.todos.v1", [{ id: "t-1" }]);
    const db = fakeDb({ todos: [{ id: "t-0" }] }, "denied"); // a viewer
    await connect(db, ["todos"]);
    const [report] = await importFromBrowser(["todos"]);
    expect(report).toMatchObject({ added: 1, problem: "denied" });
    expect(JSON.parse(readRaw("todos")).map((r: Rec) => r.id)).toEqual(["t-0"]);
  });

  it("reports a save that did not go through, so the browser's copy is not thrown away", async () => {
    put("adflo.todos.v1", [{ id: "t-1" }]);
    const db = fakeDb({}, "down");
    await connect(db, ["todos"]);
    const [report] = await importFromBrowser(["todos"]);
    expect(report).toMatchObject({ added: 1, problem: "failed" });
  });

  it("does nothing when no workspace is connected: it never writes records back into the browser", async () => {
    put("adflo.todos.v1", [{ id: "t-1" }]);
    expect(await importFromBrowser(["todos"])).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem("adflo.todos.v1")!)).toEqual([{ id: "t-1" }]);
  });

  it("does nothing for a service that has nothing to import", async () => {
    const db = fakeDb();
    await connect(db, ["todos"]);
    expect(await importFromBrowser(["todos"])).toEqual([]);
    expect(db.saves).toEqual([]);
  });
});

describe("removing the old copy", () => {
  it("removes only the browser's copy of what was chosen", async () => {
    put("adflo.todos.v1", [{ id: "t-1" }]);
    put("adflo.reminders.v1", [{ id: "r-1" }]);
    const db = fakeDb();
    await connect(db, ["todos", "reminders"]);
    removeBrowserCopies(["todos"]);
    expect(window.localStorage.getItem("adflo.todos.v1")).toBeNull();
    expect(window.localStorage.getItem("adflo.reminders.v1")).not.toBeNull();
    expect(db.saves).toEqual([]);
  });
});
