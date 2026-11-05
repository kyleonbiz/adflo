import { parseAgreementText } from "@/lib/control/agreement-text";

/** Agreement text laid out with headings, paragraphs and lists, in the app's type. */
export function AgreementText({ body }: { body: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {parseAgreementText(body).map((b, i) => {
        if (b.kind === "heading") {
          const cls = b.level === 1 ? "pt-2 text-lg font-semibold tracking-tight" : b.level === 2 ? "pt-2 text-base font-semibold" : "pt-1 text-sm font-semibold text-muted-foreground";
          return b.level === 1 ? <h2 key={i} className={cls}>{b.text}</h2> : b.level === 2 ? <h3 key={i} className={cls}>{b.text}</h3> : <h4 key={i} className={cls}>{b.text}</h4>;
        }
        if (b.kind === "list") {
          const Tag = b.ordered ? "ol" : "ul";
          return <Tag key={i} className={`space-y-1.5 pl-5 marker:text-muted-foreground ${b.ordered ? "list-decimal" : "list-disc"}`}>{b.items.map((t, j) => <li key={j}>{t}</li>)}</Tag>;
        }
        return <p key={i}>{b.text}</p>;
      })}
    </div>
  );
}
