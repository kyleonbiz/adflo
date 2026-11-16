// @vitest-environment jsdom
// The shared services (to-dos, reminders, signing, packets, scheduled reports, project types, and the three
// single-object ones: settings, setup, approval chains) save to the workspace database when one is connected,
// and in this browser otherwise, under the key each one has always used.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Rec } from "@/lib/records/diff";
import { configureRemote, stopRemote, type RecordsBackend } from "@/lib/records/remote";
import { SINGLE_ID, readRaw, readSingleRaw, writeRecords } from "@/lib/records/storage";
import { saveTodos } from "@/lib/todos/storage";
import { saveReminders } from "@/lib/reminders/storage";
import { saveSettings, parseSettings, SETTINGS_KEY } from "@/lib/settings/storage";
import { clearConfig, saveConfig, parseStored, STORAGE_KEY } from "@/lib/setup/storage";
import { saveChains } from "@/lib/approvals/storage";
import { defaultSettings } from "@/lib/settings/types";
import { emptyConfig } from "@/lib/setup/types";

type Save = { kind: string; upserts: Rec[]; deletes: string[] };

/** A "database" that holds what it is given, and remembers every save. */
function fakeDb(initial: Record<string, Rec[]> = {}) {
  const rows = new Map<string, Rec[]>(Object.entries(initial));
  const saves: Save[] = [];
  const backend: RecordsBackend = {
    async load(kind) { const r = rows.get(kind); return { records: r ?? [], saved: !!r }; },
    async save(kind, change) {
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
const connect = async (db: ReturnType<typeof fakeDb>, kinds: Parameters<typeof configureRemote>[2]) => {
  configureRemote("ws-1", () => db.backend, kinds);
  await tick();
};

beforeEach(() => window.localStorage.clear());
afterEach(() => stopRemote());

describe("in this browser (the preview, or no database)", () => {
  it("lists keep the key they always had, so what is already saved is still read", () => {
    window.localStorage.setItem("adflo.todos.v1", JSON.stringify([{ id: "t-old", title: "From before" }]));
    expect(JSON.parse(readRaw("todos"))).toEqual([{ id: "t-old", title: "From before" }]);
    saveTodos([{ id: "t-new" } as never]);
    expect(JSON.parse(window.localStorage.getItem("adflo.todos.v1")!)).toEqual([{ id: "t-new" }]);
    saveReminders([{ id: "r-1" } as never]);
    expect(JSON.parse(window.localStorage.getItem("adflo.reminders.v1")!)).toEqual([{ id: "r-1" }]);
  });

  it("every service has its own key, and the first five keep theirs", () => {
    for (const [kind, key] of [
      ["signing", "adflo.signing.v1"], ["packets", "adflo.packets.v1"], ["schedules", "adflo.scheduled-reports.v1"],
      ["projecttypes", "adflo.project-types.v1"], ["invoices", "adflo.records.invoices.v1"], ["licenses", "adflo.records.licenses.v1"],
    ] as const) {
      writeRecords(kind, [{ id: `${kind}-1` }]);
      expect(window.localStorage.getItem(key), kind).toBe(JSON.stringify([{ id: `${kind}-1` }]));
    }
  });

  it("settings, setup and approval chains are kept as one object under their old keys", () => {
    const settings = { ...defaultSettings(), details: { ...defaultSettings().details, email: "boss@example.com" } };
    saveSettings(settings);
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_KEY)!)).toEqual(settings);
    expect(parseSettings(readSingleRaw("settings")).details.email).toBe("boss@example.com");

    const config = { ...emptyConfig(), business: { ...emptyConfig().business, name: "Harbor Signs" } };
    saveConfig(config);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).business.name).toBe("Harbor Signs");
    expect(parseStored(readSingleRaw("setup"))?.business.name).toBe("Harbor Signs");

    saveChains({ requests: ["Owner"], forms: [] } as never);
    expect(JSON.parse(window.localStorage.getItem("adflo.approval-chains.v1")!)).toEqual({ requests: ["Owner"], forms: [] });
  });

  it("'Start over' forgets the saved setup", () => {
    saveConfig(emptyConfig());
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    clearConfig();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(readSingleRaw("setup")).toBe("");
  });
});

describe("with a database connected", () => {
  it("a list service reads the workspace's records and ignores the browser's old copy", async () => {
    window.localStorage.setItem("adflo.todos.v1", JSON.stringify([{ id: "stale", title: "Old browser copy" }]));
    const db = fakeDb({ todos: [{ id: "db-1", title: "From the workspace" }] });
    await connect(db, ["todos"]);
    expect(JSON.parse(readRaw("todos"))).toEqual([{ id: "db-1", title: "From the workspace" }]);
  });

  it("saving a list sends only what changed, to the database, and leaves the browser's copy alone", async () => {
    const db = fakeDb({ todos: [{ id: "a", title: "A" }, { id: "b", title: "B" }] });
    window.localStorage.setItem("adflo.todos.v1", "[]");
    await connect(db, ["todos"]);
    saveTodos([{ id: "a", title: "A" }, { id: "b", title: "B2" }, { id: "c", title: "C" }] as never);
    await tick();
    expect(db.saves).toHaveLength(1);
    expect(db.saves[0]!.kind).toBe("todos");
    expect(db.saves[0]!.upserts.map((r) => r.id).sort()).toEqual(["b", "c"]);
    expect(db.saves[0]!.deletes).toEqual([]);
    expect(window.localStorage.getItem("adflo.todos.v1")).toBe("[]");
  });

  it("deleting from a list deletes that record", async () => {
    const db = fakeDb({ reminders: [{ id: "r1" }, { id: "r2" }] });
    await connect(db, ["reminders"]);
    saveReminders([{ id: "r1" }] as never);
    await tick();
    expect(db.saves[0]).toMatchObject({ kind: "reminders", upserts: [], deletes: ["r2"] });
  });

  it("a single-object service is one record, and reads back as the object without its record id", async () => {
    const settings = { ...defaultSettings(), details: { ...defaultSettings().details, phone: "555-0100" } };
    const db = fakeDb({ settings: [{ ...settings, id: SINGLE_ID }] });
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaultSettings()));
    await connect(db, ["settings"]);
    const raw = readSingleRaw("settings");
    expect(JSON.parse(raw)).toEqual(settings);
    expect(JSON.parse(raw).id).toBeUndefined();
    expect(parseSettings(raw).details.phone).toBe("555-0100");
  });

  it("saving a single-object service writes one record with the fixed id", async () => {
    const db = fakeDb({ settings: [{ ...defaultSettings(), id: SINGLE_ID }] });
    await connect(db, ["settings", "setup", "chains"]);
    const next = { ...defaultSettings(), details: { ...defaultSettings().details, email: "new@example.com" } };
    saveSettings(next);
    await tick();
    expect(db.saves).toHaveLength(1);
    expect(db.saves[0]!.kind).toBe("settings");
    expect(db.saves[0]!.upserts).toEqual([{ ...next, id: SINGLE_ID }]);
    expect(parseSettings(readSingleRaw("settings")).details.email).toBe("new@example.com");
  });

  it("'Start over' deletes the saved setup record", async () => {
    const config = emptyConfig();
    const db = fakeDb({ setup: [{ ...config, id: SINGLE_ID }] });
    await connect(db, ["setup"]);
    expect(parseStored(readSingleRaw("setup"))).not.toBeNull();
    clearConfig();
    await tick();
    expect(db.saves[0]).toMatchObject({ kind: "setup", deletes: [SINGLE_ID] });
    expect(readSingleRaw("setup")).toBe("");
  });

  it("nothing is saved before the workspace's records have loaded", async () => {
    let release!: () => void;
    const open = new Promise<void>((r) => { release = r; });
    const saves: string[] = [];
    configureRemote("ws-1", () => ({
      async load() { await open; return { records: [], saved: false }; },
      async save(kind) { saves.push(kind); },
    }), ["setup"]);
    saveConfig(emptyConfig()); // still loading: refused rather than written on top of an unread copy
    await tick();
    expect(saves).toEqual([]);
    release();
    await tick();
    expect(saves).toEqual([]);
  });
});
