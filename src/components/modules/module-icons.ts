import {
  BarChart3, ClipboardList, FileText, FolderKanban, FolderTree, Home, Inbox, Receipt, Settings, ShieldCheck, Store, Users,
  type LucideIcon,
} from "lucide-react";

/** One icon per module (plus "overview"), shared by the sidebar and the public landing page. */
export const MODULE_ICONS: Record<string, LucideIcon> = {
  overview: Home, documents: FileText, invoices: Receipt, licenses: ShieldCheck, vendors: Store, crm: Users,
  projects: FolderKanban, forms: ClipboardList, reporting: BarChart3, admin: Inbox, "file-reset": FolderTree, setup: Settings,
};
