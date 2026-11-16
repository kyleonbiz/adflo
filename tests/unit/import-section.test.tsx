// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportSection } from "@/components/settings/import-section";
import type { Rec } from "@/lib/records/diff";
import { RecordsSyncError, configureRemote, stopRemote, type RecordsBackend } from "@/lib/records/remote";

const put = (key: string, value: unknown) => window.localStorage.setItem(key, JSON.stringify(value));
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

function db(initial: Record<string, Rec[]> = {}, deny = false) {
  const rows = new Map<string, Rec[]>(Object.entries(initial));
  const backend: RecordsBackend = {
    async load(kind) { const r = rows.get(kind); return { records: r ?? [], saved: !!r }; },
    async save(kind, change) {
      if (deny) throw new RecordsSyncError("denied");
      const map = new Map((rows.get(kind) ?? []).map((r) => [r.id, r]));
      for (const r of change.upserts) map.set(r.id, r);
      for (const id of change.deletes) map.delete(id);
      rows.set(kind, [...map.values()]);
    },
  };
  return { backend, rows };
}
const connect = async (d: ReturnType<typeof db>, kinds: Parameters<typeof configureRemote>[2]) => {
  configureRemote("ws-1", () => d.backend, kinds);
  await tick();
};

beforeEach(() => window.localStorage.clear());
afterEach(() => stopRemote());

describe("Import from this browser", () => {
  it("in the preview, says there is no workspace to import into", () => {
    render(<ImportSection />);
    expect(screen.getByText(/This is the preview/)).toBeTruthy();
    expect(screen.queryByTestId("import-run")).toBeNull();
  });

  it("with a workspace and nothing in the browser, says so", async () => {
    await connect(db(), ["todos"]);
    render(<ImportSection />);
    expect(screen.getByTestId("import-empty")).toBeTruthy();
  });

  it("lists what the browser holds, with what would be added and what is skipped", async () => {
    put("adflo.records.vendors.v1", [{ id: "v1", name: "Local" }, { id: "v2", name: "New" }, { id: "demo-v-1", name: "Sample" }]);
    put("aurum.setup.v1", { business: { name: "Harbor" } });
    await connect(db({ vendors: [{ id: "v1", name: "Workspace" }] }), ["vendors", "setup"]);
    render(<ImportSection />);
    const vendors = screen.getByTestId("import-vendors");
    expect(vendors.textContent).toContain("1 record to add");
    expect(vendors.textContent).toContain("1 record is already in your workspace");
    expect(vendors.textContent).toContain("1 sample record skipped");
    expect(screen.getByTestId("import-setup").textContent).toContain("Will be saved to your workspace");
    expect((screen.getByLabelText(/Vendors/) as HTMLInputElement).checked).toBe(true);
  });

  it("imports what is ticked, reports it, and can then remove the old copy", async () => {
    put("adflo.records.vendors.v1", [{ id: "v1" }, { id: "v2" }]);
    put("adflo.todos.v1", [{ id: "t1" }]);
    const d = db();
    await connect(d, ["vendors", "todos"]);
    render(<ImportSection />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/To-dos/)); // untick one
    await user.click(screen.getByTestId("import-run"));
    await tick();
    const result = await screen.findByTestId("import-result");
    expect(result.textContent).toContain("Vendors: 2 records added");
    expect(result.textContent).not.toContain("To-dos");
    expect(d.rows.get("vendors")!.map((r) => r.id).sort()).toEqual(["v1", "v2"]);
    expect(d.rows.has("todos")).toBe(false);

    await user.click(screen.getByTestId("import-remove"));
    expect(window.localStorage.getItem("adflo.records.vendors.v1")).not.toBeNull(); // asks first
    await user.click(screen.getByTestId("import-remove-confirm"));
    expect(window.localStorage.getItem("adflo.records.vendors.v1")).toBeNull();
    expect(window.localStorage.getItem("adflo.todos.v1")).not.toBeNull(); // the one not imported is left alone
    expect(d.rows.get("vendors")!).toHaveLength(2); // and the workspace is untouched
  });

  it("tells a viewer nothing was imported, and offers no way to remove the browser's copy", async () => {
    put("adflo.todos.v1", [{ id: "t1" }]);
    await connect(db({}, true), ["todos"]);
    render(<ImportSection />);
    await userEvent.setup().click(screen.getByTestId("import-run"));
    await tick();
    const result = await screen.findByTestId("import-result");
    expect(within(result).getByText(/view-only access/)).toBeTruthy();
    expect(screen.queryByTestId("import-remove")).toBeNull();
    expect(window.localStorage.getItem("adflo.todos.v1")).not.toBeNull();
  });

  it("when everything is already in the workspace, there is nothing to import", async () => {
    put("adflo.todos.v1", [{ id: "t1" }]);
    await connect(db({ todos: [{ id: "t1" }] }), ["todos"]);
    render(<ImportSection />);
    expect(screen.getByTestId("import-todos").textContent).toContain("Nothing new to add");
    expect((screen.getByTestId("import-run") as HTMLButtonElement).disabled).toBe(true);
  });
});
