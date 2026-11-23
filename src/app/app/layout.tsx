import { renderAppLayout } from "@/lib/app-shell";

// The menu, top bar and loaded records live here, so moving between pages does not rebuild them.
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  return renderAppLayout(children);
}
