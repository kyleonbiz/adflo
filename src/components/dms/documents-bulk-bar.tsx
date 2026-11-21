"use client";

import { useState } from "react";
import { BulkBar } from "@/components/ui/bulk-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DocumentRecord, FolderWithCount } from "@/lib/dms/types";

/** The bulk bar over the document grid: move the selected documents to a folder, add a tag to all of them, or move them to the trash. */
export function DocumentsBulkBar({ selected, total, folders, onSelectAll, onClear, onMove, onTag, onTrash }: {
  selected: DocumentRecord[]; total: number; folders: FolderWithCount[];
  onSelectAll: () => void; onClear: () => void;
  onMove: (folderId: string) => void; onTag: (tag: string) => void; onTrash: () => void;
}) {
  const [tag, setTag] = useState("");
  return (
    <BulkBar count={selected.length} total={total} noun="documents selected" onSelectAll={onSelectAll} onClear={onClear}>
      <Select value="" onValueChange={onMove}>
        <SelectTrigger aria-label="Move selected to folder" className="h-8 w-40 text-xs"><SelectValue placeholder="Move to folder" /></SelectTrigger>
        <SelectContent>{folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
      </Select>
      <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); if (tag.trim()) { onTag(tag.trim()); setTag(""); } }}>
        <Input value={tag} onChange={(e) => setTag(e.target.value)} maxLength={32} placeholder="Add a tag" aria-label="Tag to add to selected" className="h-8 w-32 text-xs" />
        <Button type="submit" size="sm" variant="outline" disabled={!tag.trim()}>Add tag</Button>
      </form>
      <Button size="sm" variant="destructive" onClick={onTrash}>Move to trash</Button>
    </BulkBar>
  );
}
