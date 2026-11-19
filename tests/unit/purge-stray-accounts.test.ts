import { describe, expect, it, vi } from "vitest";
import { purgeStrayAccounts } from "@/lib/dms/server/purge-stray-accounts";

function fakeAdmin(strays: { id: string }[], failFor: string[] = []) {
  const deleted: string[] = [];
  const admin = {
    rpc: vi.fn(async () => ({ data: strays, error: null })),
    auth: { admin: { deleteUser: async (id: string) => { if (failFor.includes(id)) return { error: { message: "x" } }; deleted.push(id); return { error: null }; } } },
  };
  return { admin: admin as never, deleted, rpc: admin.rpc };
}

describe("purgeStrayAccounts", () => {
  it("removes each stray and reports counts only", async () => {
    const { admin, deleted, rpc } = fakeAdmin([{ id: "u1" }, { id: "u2" }]);
    expect(await purgeStrayAccounts(admin)).toEqual({ found: 2, removed: 2, failed: 0 });
    expect(deleted).toEqual(["u1", "u2"]);
    expect(rpc).toHaveBeenCalledWith("dms_stray_accounts", { p_grace: "7 days" });
  });
  it("counts a failure and carries on with the rest", async () => {
    const { admin, deleted } = fakeAdmin([{ id: "u1" }, { id: "u2" }], ["u1"]);
    expect(await purgeStrayAccounts(admin)).toEqual({ found: 2, removed: 1, failed: 1 });
    expect(deleted).toEqual(["u2"]);
  });
  it("deletes nothing on a dry run", async () => {
    const { admin, deleted } = fakeAdmin([{ id: "u1" }]);
    expect(await purgeStrayAccounts(admin, true)).toEqual({ found: 1, removed: 0, failed: 0 });
    expect(deleted).toEqual([]);
  });
});
