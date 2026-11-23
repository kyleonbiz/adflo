/** The amber note shown on a screen that is running as a no-database preview. */
export function PreviewNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="note" className="py-1 pl-3 text-sm border-l-2 border-amber-500 text-foreground">{children}</p>
  );
}
