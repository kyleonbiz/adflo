import { DmsError, toDmsError } from "../errors";
import { loadUploadLimitsForBrowser } from "./limits";
import type { DmsApi, DocumentChanges, UploadArgs } from "./api";
import { DocumentService } from "../service";
import { DEV_USER_ID, DEV_USER_NAME, DEV_WORKSPACE_ID, createWorkspaceKit } from "../memory/workspace";
import type { DocumentQuery } from "../types";

/**
 * Runs the real DocumentService against in-browser memory. Used on the public
 * demo page. Nothing is sent to a server or persisted, and the UI says so.
 */
export function createLocalApi(kit: Pick<ReturnType<typeof createWorkspaceKit>, "repo" | "storage" | "store"> = createWorkspaceKit()): DmsApi {
  const service = new DocumentService({
    repo: kit.repo,
    storage: kit.storage,
    limits: loadUploadLimitsForBrowser(),
    userEmail: "you@example.com",
    ctx: {
      workspaceId: DEV_WORKSPACE_ID,
      userId: DEV_USER_ID,
      userName: kit.store.members.get(`${DEV_WORKSPACE_ID}:${DEV_USER_ID}`)?.displayName ?? DEV_USER_NAME,
      role: "owner",
    },
  });
  async function run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      throw toDmsError(e);
    }
  }

  return {
    mode: "demo",
    capabilities: { share: false, team: false },
    bootstrap: () => run(() => service.bootstrap()),
    listDocuments: (q: DocumentQuery) => run(() => service.listDocuments(q)),
    getDocument: (id) => run(() => service.getDocument(id)),
    updateDocument: (id, changes: DocumentChanges) => run(() => service.updateDocument(id, changes)),
    deleteDocument: (id) => run(() => service.deleteDocument(id)),
    restoreDocument: (id) => run(() => service.restoreDocument(id)),
    purgeDocument: (id) => run(() => service.purgeDocument(id)),
    getFileLink: (id, opts) => run(() => service.getFileLink(id, opts)),
    createShareLink: () =>
      Promise.reject(new DmsError("unavailable", "Share links need a connected workspace.")),
    listShareLinks: (id) => run(() => service.listShareLinks(id)),
    revokeShareLink: (id, linkId) => run(() => service.revokeShareLink(id, linkId)),
    getTeam: () => run(() => service.listTeam()),
    inviteMember: (email, role) => run(() => service.inviteMember({ email, role })),
    revokeInvite: (id) => run(() => service.revokeInvite(id)),
    changeMemberRole: (userId, role) => run(() => service.changeMemberRole(userId, { role })),
    removeMember: (userId) => run(() => service.removeMember(userId)),
    createFolder: (name) => run(() => service.createFolder({ name })),
    renameFolder: (id, name) => run(() => service.renameFolder(id, { name })),
    deleteFolder: (id) => run(() => service.deleteFolder(id)),
    uploadFile: (args: UploadArgs) =>
      run(async () => {
        const init = await service.initiateUpload({
          fileName: args.file.name,
          size: args.file.size,
          mimeType: args.file.type,
          folderId: args.folderId,
          category: args.category,
          documentId: args.documentId,
        });
        try {
          if (args.signal?.aborted) throw new DmsError("conflict", "Upload cancelled.");
          args.onProgress?.(0, args.file.size);
          const bytes = new Uint8Array(await args.file.arrayBuffer());
          if (args.signal?.aborted) throw new DmsError("conflict", "Upload cancelled.");
          const version = await kit.repo.getVersion(DEV_WORKSPACE_ID, init.documentId, init.versionNumber);
          kit.storage.put(version!.storageKey, bytes, version!.mimeType);
          args.onProgress?.(args.file.size, args.file.size);
          const doc = await service.finalizeUpload(init.documentId, init.versionNumber);
          // Local extraction is quick; wait so the demo shows the document as searchable at once.
          await service.indexDocument(doc.id, doc.currentVersion);
          return (await kit.repo.getDocument(DEV_WORKSPACE_ID, doc.id)) ?? doc;
        } catch (e) {
          await service.abortUpload(init.documentId, init.versionNumber).catch(() => undefined);
          throw e;
        }
      }),
  };
}
