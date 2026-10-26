"use client";

import { useState } from "react";
import { Download, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** State for the "choose a file or paste text" step. Files are read in the browser, never uploaded. */
export function useCsvInput({ allowExcel = false }: { allowExcel?: boolean } = {}) {
  const [text, setTextState] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  return {
    text, fileName, error, setError,
    setText: (t: string) => { setTextState(t); setFileName(""); },
    readFile: async (file: File | undefined) => {
      if (!file) return;
      if (file.size > MAX_FILE_BYTES) { setError("That file is larger than 2 MB. Split it into smaller files."); return; }
      try {
        const isExcel = allowExcel && /\.xlsx$/i.test(file.name);
        setTextState(isExcel ? (await import("@/lib/datasets/xlsx-read")).xlsxToCsv(new Uint8Array(await file.arrayBuffer())) : await file.text());
      } catch (e) {
        setError(e instanceof Error && e.message ? e.message : "That file could not be read.");
        return;
      }
      setFileName(file.name);
      setError("");
    },
  };
}

export function downloadText(text: string, name: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // revoking at once can cancel the download in some browsers
}

export function CsvSource({
  input, placeholder, onTemplate, allowExcel = false,
}: {
  input: ReturnType<typeof useCsvInput>;
  placeholder: string;
  onTemplate?: () => void;
  allowExcel?: boolean;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-medium hover:bg-muted">
          <FileUp className="size-4" aria-hidden /> Choose file
          <input type="file" accept={allowExcel ? ".csv,.txt,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : ".csv,.txt,text/csv,text/plain"} className="sr-only" aria-label="Choose a CSV file" onChange={(e) => void input.readFile(e.target.files?.[0])} />
        </label>
        {onTemplate && <Button type="button" variant="ghost" onClick={onTemplate}><Download /> Download template</Button>}
        {input.fileName && <span className="text-sm text-muted-foreground">{input.fileName}</span>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="import-text">Or Paste CSV Text</Label>
        <textarea
          id="import-text"
          rows={8}
          value={input.text}
          onChange={(e) => input.setText(e.target.value)}
          placeholder={placeholder}
          className="flex w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </div>
      <p className="text-xs text-muted-foreground">Up to 5,000 rows. Commas, semicolons and tabs are detected automatically. {allowExcel && "Excel (.xlsx) files import their first sheet. "}Nothing is uploaded: the file is read in your browser.</p>
    </>
  );
}
