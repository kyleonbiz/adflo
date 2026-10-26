"use client";

import { useState } from "react";
import type { ApiMode } from "@/lib/dms/client/api";
import { createHttpApi } from "@/lib/dms/client/http-api";
import { DocumentManagementPage } from "./document-management-page";

export function LiveWorkspace({ mode, startUpload, initialSearch }: { mode: Exclude<ApiMode, "demo">; startUpload?: boolean; initialSearch?: string }) {
  const [api] = useState(() => createHttpApi(mode));
  return <DocumentManagementPage api={api} startUpload={startUpload} initialSearch={initialSearch} />;
}
