import type { Metadata } from "next";
import { FormsPage } from "@/components/forms/forms-page";
import { personFromParams } from "@/lib/bridge";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Forms & Paperwork" };
export const dynamic = "force-dynamic";

export default async function FormsRoute({ searchParams }: PageProps<"/app/forms">) {
  const params = await searchParams;
  const { q } = params;
  const one = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
  const fill = one("fill") ? { formId: one("fill")!.slice(0, 80), person: personFromParams(one) } : undefined;
  return renderAppShell("/app/forms", () => (
    <FormsPage initialFill={fill} initialQuery={typeof q === "string" ? q : ""} preview="Records are saved in this browser only, not shared with other people or devices. No notifications are sent." />
  ));
}
