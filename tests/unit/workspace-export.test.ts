import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { buildWorkspaceExport } from "@/lib/export/workspace-export";

type Row = Record<string, unknown>;

/** A tiny in-memory stand-in for the database client: filters with eq/is, then range or maybeSingle. */
function fakeDb(tables: Record<string, Row[]>, files: Record<string, string>) {
  const builder = (rows: Row[]) => {
    let list = rows;
    const b: Record<string, unknown> = {
      select: () => b,
      eq: (k: string, v: unknown) => { list = list.filter((r) => r[k] === v); return b; },
      is: (k: string, v: unknown) => { list = list.filter((r) => (r[k] ?? null) === v); return b; },
      order: () => b,
      range: (from: number, to: number) => Promise.resolve({ data: list.slice(from, to + 1), error: null }),
      maybeSingle: () => Promise.resolve({ data: list[0] ?? null, error: null }),
    };
    return b;
  };
  return {
    from: (t: string) => builder(tables[t] ?? []),
    storage: { from: () => ({ createSignedUrl: async (key: string) => (key in files ? { data: { signedUrl: `https://files.test/${key}` } } : { data: null }) }) },
  } as never;
}

async function collect(s: ReadableStream<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  const r = s.getReader();
  for (;;) { const { done, value } = await r.read(); if (done) break; chunks.push(value); }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0; for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

const WS = "w1";
const doc = (o: Row): Row => ({ workspace_id: WS, status: "ready", deleted_at: null, category: "other", mime_type: "text/plain", size_bytes: 5, folder_id: null, uploaded_by_name: "Sam", created_at: "2026-11-01T00:00:00Z", expires_at: null, current_version: 1, ...o });

const tables = (): Record<string, Row[]> => ({
  document_folders: [{ workspace_id: WS, id: "f1", name: "Taxes" }],
  documents: [
    doc({ id: "d1", display_name: "W-9", original_name: "w9.txt", folder_id: "f1" }),
    doc({ id: "d2", display_name: "Notes", original_name: "notes.txt" }),
    doc({ id: "d3", display_name: "Trashed", original_name: "trash.txt", deleted_at: "2026-11-02T00:00:00Z" }),
    doc({ id: "d4", display_name: "Notes", original_name: "notes.txt" }),
  ],
  document_versions: [
    { workspace_id: WS, status: "ready", document_id: "d1", version_number: 1, storage_key: "w1/d1/v1" },
    { workspace_id: WS, status: "ready", document_id: "d2", version_number: 1, storage_key: "w1/d2/v1" },
    { workspace_id: WS, status: "ready", document_id: "d4", version_number: 1, storage_key: "w1/d4/missing" },
  ],
  workspace_records: [
    { workspace_id: WS, kind: "contacts", id: "c1", data: { name: "Dana", email: "d@x.com" } },
    { workspace_id: WS, kind: "vendors", id: "v1", data: { name: "Acme" } },
  ],
  workspace_record_sets: [],
  workspace_activity: [{ workspace_id: WS, at: "2026-11-01T00:00:00Z", data: { verb: "added" } }],
  workspace_members: [{ workspace_id: WS, display_name: "Sam", email: "sam@x.com", role: "owner", created_at: "2026-10-01T00:00:00Z" }],
});

describe("buildWorkspaceExport", () => {
  it("packs records, team, an index and the files, leaving out the trash and unreadable files", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string) => (url.endsWith("/w1/d1/v1") ? new Response("tax!!") : url.endsWith("/w1/d2/v1") ? new Response("notes") : new Response("", { status: 404 }))) as typeof fetch;
    try {
      const out = await buildWorkspaceExport(fakeDb(tables(), { "w1/d1/v1": "", "w1/d2/v1": "", "w1/d4/missing": "" }), { id: WS, name: "Acme Roofing" }, new Date("2026-11-18T12:00:00Z"));
      expect(out.tooLarge).toBe(false);
      expect(out.filename).toBe("adflo-export-acme-roofing-2026-11-18.zip");
      const zip = unzipSync(await collect(out.stream!));
      expect(Object.keys(zip).sort()).toEqual([
        "NOT-INCLUDED.txt", "README.txt", "documents/Taxes/w9.txt", "documents/Unfiled/notes.txt",
        "documents/index.csv", "records/activity.json", "records/contacts.csv", "records/contacts.json", "records/vendors.csv", "records/vendors.json", "team.csv",
      ].sort());
      expect(strFromU8(zip["documents/Taxes/w9.txt"])).toBe("tax!!");
      expect(strFromU8(zip["documents/Unfiled/notes.txt"])).toBe("notes");
      expect(strFromU8(zip["documents/index.csv"])).not.toContain("trash.txt");
      expect(strFromU8(zip["NOT-INCLUDED.txt"])).toContain("notes (2).txt");
      expect(JSON.parse(strFromU8(zip["records/contacts.json"]))).toEqual([{ name: "Dana", email: "d@x.com", id: "c1" }]);
      expect(strFromU8(zip["records/contacts.csv"])).toContain("c1,Dana,d@x.com");
      expect(strFromU8(zip["team.csv"])).toContain("Sam,sam@x.com,owner");
      expect(strFromU8(zip["README.txt"])).toContain("contacts: 1");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("refuses a workspace bigger than the limit, without reading any file", async () => {
    const out = await buildWorkspaceExport(fakeDb(tables(), {}), { id: WS, name: "Big" }, new Date("2026-11-18T12:00:00Z"), 10);
    expect(out.tooLarge).toBe(true);
    expect(out.stream).toBeUndefined();
    expect(out.totalBytes).toBe(15);
  });
});
