import { describe, expect, it, vi } from "vitest";
import { purgeDueWorkspaces } from "@/lib/dms/server/purge-workspaces";

interface Opts {
  due: { id: string; requested_by: string | null }[];
  keys?: Record<string, string[]>;
  removeFails?: boolean;
  deleteFails?: boolean;
  memberships?: number;
  staff?: number;
}

function fakeAdmin(o: Opts) {
  const calls = { removed: [] as string[][], deletedWorkspaces: [] as string[], deletedUsers: [] as string[], order: [] as string[] };
  const admin = {
    rpc: vi.fn(async () => ({ data: o.due, error: null })),
    from: (table: string) => {
      let ws = "";
      const b: Record<string, unknown> = {
        select: (_c?: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) return { eq: async () => ({ count: table === "staff_members" ? o.staff ?? 0 : o.memberships ?? 0 }) };
          return b;
        },
        eq: (_k: string, v: string) => { ws = v; return b; },
        order: () => b,
        range: async () => ({ data: (o.keys?.[ws] ?? []).map((storage_key) => ({ storage_key })), error: null }),
        delete: () => ({ eq: async (_k: string, id: string) => { calls.order.push("row"); if (!o.deleteFails) calls.deletedWorkspaces.push(id); return { error: o.deleteFails ? { message: "x" } : null }; } }),
      };
      return b;
    },
    storage: { from: () => ({ remove: async (batch: string[]) => { calls.order.push("files"); calls.removed.push(batch); return { error: o.removeFails ? { message: "x" } : null }; } }) },
    auth: { admin: { deleteUser: async (id: string) => { calls.deletedUsers.push(id); return { error: null }; } } },
  };
  return { admin: admin as never, calls };
}

describe("purgeDueWorkspaces", () => {
  it("removes the files first, then the workspace, then the closer's sign-in, and reports counts only", async () => {
    const keys = Array.from({ length: 250 }, (_, i) => `w1/d${i}/v1`);
    const { admin, calls } = fakeAdmin({ due: [{ id: "w1", requested_by: "u1" }], keys: { w1: keys } });
    const r = await purgeDueWorkspaces(admin);
    expect(r).toEqual({ found: 1, deleted: 1, failed: 0, objectsRemoved: 250, accountsRemoved: 1 });
    expect(calls.removed.map((b) => b.length)).toEqual([100, 100, 50]);
    expect(calls.order.at(-1)).toBe("row");
    expect(calls.order.indexOf("row")).toBeGreaterThan(calls.order.lastIndexOf("files"));
    expect(calls.deletedWorkspaces).toEqual(["w1"]);
    expect(calls.deletedUsers).toEqual(["u1"]);
  });

  it("keeps the person's sign-in when they belong to another workspace or are staff", async () => {
    for (const extra of [{ memberships: 1 }, { staff: 1 }]) {
      const { admin, calls } = fakeAdmin({ due: [{ id: "w1", requested_by: "u1" }], ...extra });
      const r = await purgeDueWorkspaces(admin);
      expect(r).toMatchObject({ deleted: 1, accountsRemoved: 0 });
      expect(calls.deletedUsers).toEqual([]);
    }
  });

  it("leaves the workspace for tomorrow when a file cannot be removed", async () => {
    const { admin, calls } = fakeAdmin({ due: [{ id: "w1", requested_by: "u1" }], keys: { w1: ["a", "b"] }, removeFails: true });
    const r = await purgeDueWorkspaces(admin);
    expect(r).toMatchObject({ found: 1, deleted: 0, failed: 1 });
    expect(calls.deletedWorkspaces).toEqual([]);
    expect(calls.deletedUsers).toEqual([]);
  });

  it("does not remove the sign-in when the workspace could not be deleted", async () => {
    const { admin, calls } = fakeAdmin({ due: [{ id: "w1", requested_by: "u1" }], deleteFails: true });
    expect(await purgeDueWorkspaces(admin)).toMatchObject({ deleted: 0, failed: 1, accountsRemoved: 0 });
    expect(calls.deletedUsers).toEqual([]);
  });

  it("does nothing when nothing is due", async () => {
    const { admin } = fakeAdmin({ due: [] });
    expect(await purgeDueWorkspaces(admin)).toEqual({ found: 0, deleted: 0, failed: 0, objectsRemoved: 0, accountsRemoved: 0 });
  });
});
