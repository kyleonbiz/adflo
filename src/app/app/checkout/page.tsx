import type { Metadata } from "next";
import { renderAppShell } from "@/lib/app-shell";
import { CheckoutPanel } from "@/components/checkout-panel";

export const metadata: Metadata = { title: "Start your free trial" };
export const dynamic = "force-dynamic";

export default function CheckoutRoute() {
  return renderAppShell("/app/checkout", () => <CheckoutPanel />);
}
