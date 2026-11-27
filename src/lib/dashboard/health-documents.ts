"use client";

import { useEffect, useState } from "react";
import { createHttpApi } from "@/lib/dms/client/http-api";

/** How many documents the workspace holds, when signed in to one. Null while it is being read, or when it cannot be (the tile is then left out). */
export function useDocumentCount(live: boolean): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!live) return;
    let off = false;
    createHttpApi("live").bootstrap().then((b) => { if (!off) setCount(b.usage.documentCount); }).catch(() => undefined);
    return () => { off = true; };
  }, [live]);
  return live ? count : null;
}
