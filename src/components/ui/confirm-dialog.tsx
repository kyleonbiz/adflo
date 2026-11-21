"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** One confirmation dialog for deletes, voids and other things that are hard to take back. */
export function ConfirmDialog({
  open, title, description, confirmLabel = "Delete", destructive = true, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent variant="alert">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="mt-1">{description}</DialogDescription>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
