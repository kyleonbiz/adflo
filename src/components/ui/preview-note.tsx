/** The amber note shown on a screen that is running as a no-database preview. */
export function PreviewNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{children}</p>
  );
}
