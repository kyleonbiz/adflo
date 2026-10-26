"use client";

import { useState } from "react";
import { DocumentManagementPage } from "@/components/dms/document-management-page";
import { createLocalApi } from "@/lib/dms/client/local-api";

/** Preview: the real UI and service running on an empty in-browser workspace. */
export function DemoWorkspace({ startUpload }: { startUpload?: boolean }) {
  const [api] = useState(createLocalApi);
  return <DocumentManagementPage api={api} startUpload={startUpload} />;
}
