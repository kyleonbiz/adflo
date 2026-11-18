import type { Metadata } from "next";
import { VendorProfile } from "@/components/profiles/vendor-profile";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Vendor" };
export const dynamic = "force-dynamic";

export default async function VendorProfileRoute({ params }: PageProps<"/app/vendors/[id]">) {
  const { id } = await params;
  return renderAppShell(`/app/vendors/${id}`, () => <VendorProfile id={id} />);
}
