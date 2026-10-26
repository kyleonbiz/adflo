"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DmsApi, DocumentChanges } from "@/lib/dms/client/api";
import { toDmsError } from "@/lib/dms/errors";
import { can } from "@/lib/dms/service";
import { MAX_PAGE_SIZE } from "@/lib/dms/config";
import { defaultQuery } from "@/lib/dms/validation";
import type {
  Bootstrap,
  DocumentDetail,
  DocumentQuery,
  DocumentRecord,
  FolderWithCount,
} from "@/lib/dms/types";

export interface Notice {
  id: number;
  kind: "success" | "error";
  message: string;
}

type LoadState = "loading" | "ready" | "error";

export function useDocumentManager(api: DmsApi) {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [bootState, setBootState] = useState<LoadState>("loading");
  const [bootError, setBootError] = useState("");

  const [query, setQuery] = useState<DocumentQuery>(() => ({ ...defaultQuery(), pageSize: 12 }));
  const [items, setItems] = useState<DocumentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [listState, setListState] = useState<LoadState>("loading");
  const [listError, setListError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [detailError, setDetailError] = useState("");

  const [notices, setNotices] = useState<Notice[]>([]);
  const noticeId = useRef(0);
  const listSeq = useRef(0);
  const detailSeq = useRef(0);
  // The dialog is controlled (no Radix Trigger), so remember the opener to restore focus on close.
  const opener = useRef<HTMLElement | null>(null);

  const notify = useCallback((kind: Notice["kind"], message: string) => {
    const id = ++noticeId.current;
    setNotices((n) => [...n, { id, kind, message }]);
    setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), kind === "error" ? 7000 : 4000);
  }, []);
  const dismissNotice = useCallback((id: number) => setNotices((n) => n.filter((x) => x.id !== id)), []);

  /* ---------------------------- bootstrap --------------------------- */

  const loadBootstrap = useCallback(async () => {
    try {
      const data = await api.bootstrap();
      setBoot(data);
      setBootState("ready");
    } catch (e) {
      setBootError(toDmsError(e).message);
      setBootState("error");
    }
  }, [api]);

  // Folder counts, tags, usage and trash count change after mutations. Calls made within a short
  // window share one request, so a burst of mutations (or a mutation plus a reload) costs one fetch.
  const metaPending = useRef<Promise<void> | null>(null);
  const refreshMeta = useCallback((): Promise<void> => {
    if (metaPending.current) return metaPending.current;
    metaPending.current = new Promise<void>((resolve) => {
      setTimeout(async () => {
        metaPending.current = null;
        try {
          setBoot(await api.bootstrap());
        } catch {
          /* keep the previous snapshot; the list surfaces real errors */
        }
        resolve();
      }, 120);
    });
    return metaPending.current;
  }, [api]);

  const adjustTrashCount = useCallback((delta: number) => {
    setBoot((b) => (b ? { ...b, trashCount: Math.max(0, b.trashCount + delta) } : b));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBootstrap();
  }, [loadBootstrap]);

  /* ------------------------------ list ------------------------------ */

  const fetchPage = useCallback(
    async (q: DocumentQuery, append: boolean, silent = false) => {
      const seq = ++listSeq.current;
      if (append) setLoadingMore(true);
      else if (!silent) setListState("loading");
      try {
        const page = await api.listDocuments(q);
        if (seq !== listSeq.current) return;
        setItems((prev) => (append ? [...prev, ...page.items.filter((i) => !prev.some((p) => p.id === i.id))] : page.items));
        setTotal(page.total);
        setListState("ready");
      } catch (e) {
        if (seq !== listSeq.current) return;
        if (silent) return;
        if (append) notify("error", toDmsError(e).message);
        else {
          setListError(toDmsError(e).message);
          setListState("error");
        }
      } finally {
        if (seq === listSeq.current) setLoadingMore(false);
      }
    },
    [api, notify],
  );

  const filterKey = JSON.stringify({ ...query, page: 1 });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPage({ ...query, page: 1 }, false);
    // `query` is captured through filterKey; page resets to 1 on every filter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, fetchPage]);

  const reload = useCallback(
    async (opts: { meta?: boolean } = { meta: true }) => {
      await Promise.all([fetchPage({ ...query, page: 1 }, false), opts.meta ? refreshMeta() : undefined]);
    },
    [fetchPage, query, refreshMeta],
  );

  // Text is indexed shortly after an upload finishes. While any listed document is still waiting,
  // re-read the first page quietly (backing off from 3s to 12s) so its status and any content matches appear without a manual refresh.
  const waiting = items.some((d) => d.contentStatus === "pending" && d.status === "ready");
  const pollCount = useRef(0);
  useEffect(() => {
    if (!waiting || listState !== "ready" || items.length > query.pageSize) {
      if (!waiting) pollCount.current = 0;
      return;
    }
    if (pollCount.current >= 10) return;
    const t = setTimeout(() => {
      pollCount.current += 1;
      void fetchPage({ ...query, page: 1 }, false, true);
    }, Math.min(3000 * 2 ** Math.floor(pollCount.current / 3), 12000));
    return () => clearTimeout(t);
  }, [waiting, listState, items, query, fetchPage]);

  const hasMore = items.length < total;
  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    const size = query.pageSize;
    if (items.length % size === 0) {
      void fetchPage({ ...query, page: items.length / size + 1 }, true);
    } else if (items.length + size <= MAX_PAGE_SIZE) {
      // Items were removed locally, so a page offset would skip rows that shifted up. Re-read
      // everything loaded so far plus one more page in a single request instead.
      setLoadingMore(true);
      void fetchPage({ ...query, page: 1, pageSize: items.length + size }, false, true);
    } else {
      void fetchPage({ ...query, page: Math.floor(items.length / size) + 1 }, true);
    }
  }, [hasMore, loadingMore, query, items.length, fetchPage]);

  const patchQuery = useCallback((patch: Partial<DocumentQuery>) => {
    setQuery((q) => {
      const next = { ...q, ...patch, page: 1 };
      // "Best match" only makes sense while searching: switch to it when a search starts
      // (unless the person picked a sort), and back to newest when the search is cleared.
      if (patch.search !== undefined && patch.sort === undefined) {
        if (next.search.trim() && q.sort === "newest") next.sort = "relevance";
        else if (!next.search.trim() && q.sort === "relevance") next.sort = "newest";
      }
      return next;
    });
  }, []);

  /* ----------------------------- details ---------------------------- */

  const openDocument = useCallback(
    async (id: string | null) => {
      if (id && document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
      setSelectedId(id);
      setDetail(null);
      setDetailError("");
      if (!id) return;
      const seq = ++detailSeq.current;
      try {
        const d = await api.getDocument(id);
        if (seq === detailSeq.current) setDetail(d);
      } catch (e) {
        if (seq === detailSeq.current) setDetailError(toDmsError(e).message);
      }
    },
    [api],
  );

  const reloadDetail = useCallback(async () => {
    if (!selectedId) return;
    try {
      setDetail(await api.getDocument(selectedId));
    } catch {
      /* leave the stale panel; the action that triggered this already reported */
    }
  }, [api, selectedId]);

  /* ---------------------------- mutations --------------------------- */

  const applyLocal = useCallback((doc: DocumentRecord) => {
    setItems((list) => list.map((d) => (d.id === doc.id ? { ...d, ...doc } : d)));
    setDetail((d) => (d && d.id === doc.id ? { ...d, ...doc } : d));
  }, []);

  const update = useCallback(
    async (id: string, changes: DocumentChanges, success?: string) => {
      // Show simple field edits immediately; moves stay server-confirmed because they remove cards.
      const before = items.find((d) => d.id === id) ?? (detail?.id === id ? detail : null);
      const optimistic = before && changes.folderId === undefined;
      if (optimistic) applyLocal({ ...before, ...changes });
      try {
        const doc = await api.updateDocument(id, changes);
        applyLocal(doc);
        if (success) notify("success", success);
        if (changes.folderId !== undefined || changes.tags !== undefined) void reload({ meta: true });
        // Moving out of the open folder view removes the card.
        if (changes.folderId !== undefined && query.folderId && changes.folderId !== query.folderId) {
          setItems((l) => l.filter((d) => d.id !== id));
        }
        return doc;
      } catch (e) {
        if (optimistic) applyLocal(before);
        notify("error", toDmsError(e).message);
        return null;
      }
    },
    [api, applyLocal, detail, items, notify, reload, query.folderId],
  );

  const toggleStar = useCallback(
    async (doc: DocumentRecord) => {
      const next = !doc.starred;
      applyLocal({ ...doc, starred: next });
      try {
        await api.updateDocument(doc.id, { starred: next });
        if (query.view === "starred" && !next) setItems((l) => l.filter((d) => d.id !== doc.id));
      } catch (e) {
        applyLocal(doc);
        notify("error", toDmsError(e).message);
      }
    },
    [api, applyLocal, notify, query.view],
  );

  const remove = useCallback(
    async (doc: DocumentRecord, permanent: boolean) => {
      try {
        if (permanent) await api.purgeDocument(doc.id);
        else await api.deleteDocument(doc.id);
        setItems((l) => l.filter((d) => d.id !== doc.id));
        setTotal((t) => Math.max(0, t - 1));
        adjustTrashCount(doc.deletedAt ? (permanent ? -1 : 0) : 1);
        if (selectedId === doc.id) void openDocument(null);
        notify("success", permanent ? "Deleted permanently." : "Moved to trash. You can restore it from Trash.");
        void refreshMeta();
        return true;
      } catch (e) {
        notify("error", toDmsError(e).message);
        return false;
      }
    },
    [api, adjustTrashCount, notify, openDocument, refreshMeta, selectedId],
  );

  const restore = useCallback(
    async (doc: DocumentRecord) => {
      try {
        await api.restoreDocument(doc.id);
        setItems((l) => l.filter((d) => d.id !== doc.id));
        setTotal((t) => Math.max(0, t - 1));
        adjustTrashCount(-1);
        if (selectedId === doc.id) void openDocument(null);
        notify("success", `Restored “${doc.displayName}”.`);
        void refreshMeta();
      } catch (e) {
        notify("error", toDmsError(e).message);
      }
    },
    [api, adjustTrashCount, notify, openDocument, refreshMeta, selectedId],
  );

  const download = useCallback(
    async (doc: DocumentRecord, versionNumber?: number) => {
      try {
        const link = await api.getFileLink(doc.id, { versionNumber, disposition: "attachment" });
        const a = document.createElement("a");
        a.href = link.url;
        a.download = doc.displayName;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (e) {
        notify("error", toDmsError(e).message);
      }
    },
    [api, notify],
  );

  /* ----------------------------- folders ---------------------------- */

  const createFolder = useCallback(
    async (name: string) => {
      try {
        const folder = await api.createFolder(name);
        notify("success", `Created folder “${folder.name}”.`);
        await refreshMeta();
        return folder;
      } catch (e) {
        notify("error", toDmsError(e).message);
        throw e;
      }
    },
    [api, notify, refreshMeta],
  );

  const renameFolder = useCallback(
    async (id: string, name: string) => {
      try {
        await api.renameFolder(id, name);
        notify("success", "Folder renamed.");
        await refreshMeta();
      } catch (e) {
        notify("error", toDmsError(e).message);
        throw e;
      }
    },
    [api, notify, refreshMeta],
  );

  const deleteFolder = useCallback(
    async (folder: FolderWithCount) => {
      try {
        await api.deleteFolder(folder.id);
        notify("success", `Deleted folder “${folder.name}”. Its documents are still in All Files.`);
        if (query.folderId === folder.id) patchQuery({ folderId: null });
        await Promise.all([refreshMeta(), fetchPage({ ...query, folderId: query.folderId === folder.id ? null : query.folderId, page: 1 }, false)]);
      } catch (e) {
        notify("error", toDmsError(e).message);
      }
    },
    [api, fetchPage, notify, patchQuery, query, refreshMeta],
  );

  /* ----------------------------- derived ---------------------------- */

  const perms = useMemo(() => {
    const role = boot?.role ?? "viewer";
    return {
      write: can(role, "write"),
      delete: can(role, "delete"),
      share: can(role, "share"),
      folders: can(role, "manage_folders"),
      purge: can(role, "purge"),
      team: can(role, "manage_team"),
    };
  }, [boot?.role]);

  const activeFolder = boot?.folders.find((f) => f.id === query.folderId) ?? null;

  return {
    api,
    boot,
    bootState,
    bootError,
    retryBootstrap: loadBootstrap,
    query,
    patchQuery,
    items,
    total,
    listState,
    listError,
    loadingMore,
    hasMore,
    loadMore,
    reload,
    selectedId,
    detail,
    detailError,
    openDocument,
    restoreFocus: () => opener.current?.isConnected && opener.current.focus(),
    reloadDetail,
    update,
    toggleStar,
    remove,
    restore,
    download,
    createFolder,
    renameFolder,
    deleteFolder,
    perms,
    activeFolder,
    notices,
    notify,
    dismissNotice,
    refreshMeta,
  };
}

export type DocumentManager = ReturnType<typeof useDocumentManager>;
