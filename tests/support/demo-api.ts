import { createLocalApi } from "@/lib/dms/client/local-api";
import { createSampleKit } from "./sample-documents";

/** The in-browser API over a workspace pre-filled with sample documents, for UI tests that need something to show. */
export const createDemoApi = () => createLocalApi(createSampleKit());
