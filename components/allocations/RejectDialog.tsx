"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface RejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: (reason: string) => void;
  isPending?: boolean;
}

export function RejectDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  isPending,
}: RejectDialogProps) {
  const [reason, setReason] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onConfirm(reason);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-full">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-foreground">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
              Reason for Rejection
            </label>
            <Textarea
              placeholder="Explain why this request is being rejected..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-xs min-h-[90px] focus:ring-primary focus:border-primary resize-none"
              required
              disabled={isPending}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isPending || !reason.trim()}
            >
              {isPending ? "Rejecting..." : "Reject Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
