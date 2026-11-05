import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FormField } from "@/lib/forms/types";

const textareaClass =
  "flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground aria-invalid:border-destructive focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

/** One input for a form field, by its type. Used when filling a form in the app and on the public page. */
export function FieldInput({ field, value, error, onChange }: { field: FormField; value: string; error?: string; onChange: (v: string) => void }) {
  const id = `fill-${field.id}`;
  const a11y = { "aria-invalid": !!error, "aria-describedby": error ? `${id}-error` : undefined };
  switch (field.type) {
    case "longtext":
      return <textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={textareaClass} {...a11y} />;
    case "select":
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id} {...a11y}><SelectValue placeholder="Choose one" /></SelectTrigger>
          <SelectContent>{field.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-sm">
          <input id={id} type="checkbox" checked={value === "true"} onChange={(e) => onChange(e.target.checked ? "true" : "false")} className="size-4 rounded border-input accent-primary" {...a11y} />
          Yes
        </label>
      );
    default:
      return (
        <Input
          id={id}
          type={field.type === "date" ? "date" : field.type === "email" ? "email" : "text"}
          inputMode={field.type === "number" ? "decimal" : undefined}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...a11y}
        />
      );
  }
}
