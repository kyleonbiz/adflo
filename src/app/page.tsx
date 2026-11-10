import { redirect } from "next/navigation";

/** AdFlo is software, not a website: opening it goes straight into the app. The marketing page lives at /landing. */
export default function RootPage() {
  redirect("/app/overview");
}
