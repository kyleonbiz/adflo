import type { Category, Folder, FolderColor, Workspace } from "../types";
import { MB } from "../config";
import { MemoryRepository, MemoryStorage, MemoryStore } from "./store";

/** The single workspace and user behind preview and development mode (no database). */
export const DEV_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
export const DEV_USER_ID = "00000000-0000-4000-8000-0000000000aa";
export const DEV_USER_NAME = "You";

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const SYSTEM_FOLDERS: { n: number; name: string; color: FolderColor; category: Category }[] = [
  { n: 10, name: "Invoices", color: "violet", category: "invoice" },
  { n: 11, name: "Receipts", color: "emerald", category: "receipt" },
  { n: 12, name: "Tax Documents", color: "amber", category: "tax" },
  { n: 13, name: "Contracts", color: "blue", category: "contract" },
  { n: 14, name: "HR Documents", color: "rose", category: "hr" },
];

/** A fresh, empty workspace: the standard folders and its owner, and no documents. */
export function createWorkspaceStore(now: Date = new Date()): MemoryStore {
  const store = new MemoryStore();
  const workspace: Workspace = { id: DEV_WORKSPACE_ID, name: "My workspace", storageQuotaBytes: 100 * MB };
  store.workspaces.set(workspace.id, workspace);
  for (const f of SYSTEM_FOLDERS) {
    const folder: Folder = {
      id: uid(f.n), workspaceId: workspace.id, name: f.name, color: f.color, isSystem: true,
      defaultCategory: f.category, createdAt: now.toISOString(),
    };
    store.folders.set(folder.id, folder);
  }
  store.members.set(`${workspace.id}:${DEV_USER_ID}`, {
    workspaceId: workspace.id, userId: DEV_USER_ID, displayName: DEV_USER_NAME, email: "you@example.com",
    role: "owner", joinedAt: now.toISOString(),
  });
  return store;
}

export function createWorkspaceKit(now?: Date) {
  const store = createWorkspaceStore(now);
  return { store, repo: new MemoryRepository(store), storage: new MemoryStorage(store) };
}
