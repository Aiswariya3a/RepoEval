"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface DeleteProjectDialogProps {
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

export function DeleteProjectDialog({
  projectName,
  open,
  onOpenChange,
  onConfirm,
}: DeleteProjectDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
      onOpenChange(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => !deleting && onOpenChange(false)}
      />
      {/* Dialog */}
      <div className="relative z-50 w-full max-w-md rounded-xl bg-card p-6 shadow-lg ring-1 ring-foreground/10">
        <h3 className="text-lg font-semibold mb-2">Delete Project</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Are you sure you want to delete <strong>{projectName}</strong>? This
          action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
