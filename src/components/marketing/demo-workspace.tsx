"use client";

import { useState } from "react";
import { DocumentManagementPage } from "@/components/dms/document-management-page";
import { createLocalApi } from "@/lib/dms/client/local-api";

/** Preview: the real UI and service running on an empty in-browser workspace. */
export function DemoWorkspace({ startUpload, initialSearch }: { startUpload?: boolean; initialSearch?: string }) {
  const [api] = useState(createLocalApi);
  return <DocumentManagementPage api={api} startUpload={startUpload} initialSearch={initialSearch} />;
}
