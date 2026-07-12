"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { returnAllocation } from "@/lib/actions/allocations";
import { ClipboardList, User, Package, AlertCircle } from "lucide-react";

interface ReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allocationId: string;
  assetName: string;
  assetTag: string;
  holderName: string;
}

export function ReturnDialog({
  open,
  onOpenChange,
  allocationId,
  assetName,
  assetTag,
  holderName,
}: ReturnDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [conditionNotes, setConditionNotes] = useState("");

  useEffect(() => {
    if (open) {
      setConditionNotes("");
    }
  }, [open]);

  const handleReturn = () => {
    if (!conditionNotes.trim()) {
      toast.error("Condition check-in notes are required");
      return;
    }

    startTransition(async () => {
      try {
        const res = await returnAllocation({
          allocationId,
          conditionNotes,
        });

        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Asset returned. Status set to Available.");
          onOpenChange(false);
          router.refresh();
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to process return");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-full">
        <DialogHeader>
          <DialogTitle>Return Asset</DialogTitle>
          <DialogDescription>
            Process return for the asset allocated to{" "}
            <span className="font-semibold text-foreground">{holderName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Asset details card */}
          <div className="bg-muted/30 border rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Package className="h-4 w-4 text-muted-foreground" />
              {assetName}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1.5 border-t border-border/50">
              <div>
                <span className="block font-medium">Asset Tag</span>
                <span className="font-mono text-foreground">{assetTag}</span>
              </div>
              <div>
                <span className="block font-medium">Current Holder</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {holderName}
                </span>
              </div>
            </div>
          </div>

          {/* Condition Notes */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <ClipboardList className="h-3.5 w-3.5" />
              Condition Check-in Notes <span className="text-destructive font-bold">*</span>
            </label>
            <Textarea
              placeholder="Describe the physical condition of the asset upon return (e.g. good condition, small scratch on cover, keys functional...)"
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              className="text-xs min-h-[90px] focus:ring-primary focus:border-primary resize-none"
              required
              disabled={isPending}
            />
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
              <AlertCircle className="h-3 w-3" />
              You must verify and document the asset's condition before check-in.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleReturn}
            disabled={isPending || !conditionNotes.trim()}
          >
            {isPending ? "Processing..." : "Confirm Return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
