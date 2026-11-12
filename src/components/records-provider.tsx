"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { configureRemote, refreshRemote, retryRemote } from "@/lib/records/remote";
import { useRecordsProblem } from "@/lib/records/storage";
import { PERSISTED_KINDS, createSupabaseBackend } from "@/lib/records/supabase-backend";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const MESSAGE = {
  denied: "You have view-only access to this workspace, so that change was not saved.",
  failed: "Your latest changes are not saved yet. We will keep trying.",
  loading: "We could not load your saved records. Trying again.",
} as const;

function SaveProblem() {
  const problem = useRecordsProblem();
  if (!problem) return null;
  const text = problem.loading ? MESSAGE.loading : MESSAGE[problem.problem];
  return (
    <div role="alert" data-testid="records-problem" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
      <span className="flex items-center gap-2"><AlertTriangle className="size-4 shrink-0" aria-hidden /> {text}</span>
      {problem.problem === "failed" && <Button size="sm" variant="outline" onClick={retryRemote}>Try now</Button>}
    </div>
  );
}

/**
 * Saves the workspace's records (licenses and tasks so far) to the database instead of this browser. It connects on the
 * first client render, so pages never show the browser's old copy first, and it picks up other people's changes when
 * the tab is shown again. Only rendered for a signed-in workspace; the preview keeps everything in the browser.
 */
export function RecordsProvider({ workspaceId, children }: { workspaceId: string; children: React.ReactNode }) {
  useState(() => {
    configureRemote(workspaceId, () => createSupabaseBackend(createBrowserSupabase(), workspaceId), PERSISTED_KINDS);
    return null;
  });
  useEffect(() => {
    const onShow = () => { if (document.visibilityState === "visible") void refreshRemote(); };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => { document.removeEventListener("visibilitychange", onShow); window.removeEventListener("focus", onShow); };
  }, []);
  return <><SaveProblem />{children}</>;
}
