import {
  BarChart3, CalendarDays, ClipboardList, FileText, FolderKanban, FolderTree, History, Home, Receipt, Settings, ShieldCheck, Sparkles, Store, Users,
  type LucideIcon,
} from "lucide-react";

/** One icon per module (plus "overview"), shared by the sidebar and the public landing page. */
export const MODULE_ICONS: Record<string, LucideIcon> = {
  overview: Home, assistant: Sparkles, activity: History, calendar: CalendarDays, documents: FileText, invoices: Receipt, licenses: ShieldCheck, vendors: Store, crm: Users,
  projects: FolderKanban, forms: ClipboardList, reporting: BarChart3, "file-reset": FolderTree, setup: Settings,
};
