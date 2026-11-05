import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicForm } from "@/components/forms/public-form";
import { decodeForm } from "@/lib/forms/share";

export const metadata: Metadata = { title: "Form", robots: { index: false, follow: false } };

/** Public form page. The form itself is carried in the link, so there is nothing to look up. */
export default async function SharedFormPage({ params }: PageProps<"/form/[token]">) {
  const { token } = await params;
  const form = decodeForm(token);
  if (!form) notFound();
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-2xl border bg-card p-6 shadow-panel">
        <h1 className="text-2xl font-semibold tracking-tight">{form.name}</h1>
        {form.description && <p className="mt-1 text-sm text-muted-foreground">{form.description}</p>}
        <div className="mt-5"><PublicForm form={form} /></div>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">Your answers are not stored on this page. You send them by email.</p>
    </main>
  );
}
