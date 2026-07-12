"use client";

import React, { useState, useTransition, useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { submitAuditItemResult } from "@/lib/actions/audits";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MapPin,
  Boxes,
  Loader2,
} from "lucide-react";

interface AuditChecklistProps {
  items: any[];
  cycleId: string;
  isEditable: boolean;
  isClosed: boolean;
}

type ResultType = "pending" | "verified" | "missing" | "damaged";

interface ItemLocalState {
  result: ResultType;
  notes: string;
  saving: boolean;
}

export function AuditChecklist({
  items,
  cycleId,
  isEditable,
  isClosed,
}: AuditChecklistProps) {
  // Local item state for optimistic updates
  const [localItems, setLocalItems] = useState<Record<string, ItemLocalState>>(
    () => {
      const map: Record<string, ItemLocalState> = {};
      for (const item of items) {
        map[item.id] = {
          result: item.result || "pending",
          notes: item.notes || "",
          saving: false,
        };
      }
      return map;
    }
  );

  const totalItems = items.length;
  const checkedCount = Object.values(localItems).filter(
    (s) => s.result !== "pending"
  ).length;
  const pct = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  const handleResultChange = useCallback(
    async (itemId: string, newResult: ResultType) => {
      if (!isEditable) return;

      const prev = localItems[itemId];
      if (prev.result === newResult) return;

      // Optimistic update
      setLocalItems((s) => ({
        ...s,
        [itemId]: { ...s[itemId], result: newResult, saving: true },
      }));

      try {
        const res = await submitAuditItemResult({
          auditItemId: itemId,
          result: newResult as "verified" | "missing" | "damaged",
          notes: localItems[itemId].notes || undefined,
        });

        if (res.error) {
          // Revert
          setLocalItems((s) => ({
            ...s,
            [itemId]: { ...s[itemId], result: prev.result, saving: false },
          }));
          toast.error(res.error);
        } else {
          setLocalItems((s) => ({
            ...s,
            [itemId]: { ...s[itemId], saving: false },
          }));
        }
      } catch {
        setLocalItems((s) => ({
          ...s,
          [itemId]: { ...s[itemId], result: prev.result, saving: false },
        }));
        toast.error("Failed to save audit result.");
      }
    },
    [isEditable, localItems]
  );

  const handleNotesBlur = useCallback(
    async (itemId: string) => {
      if (!isEditable) return;
      const local = localItems[itemId];
      if (local.result === "pending") return;

      setLocalItems((s) => ({
        ...s,
        [itemId]: { ...s[itemId], saving: true },
      }));

      try {
        const res = await submitAuditItemResult({
          auditItemId: itemId,
          result: local.result as "verified" | "missing" | "damaged",
          notes: local.notes || undefined,
        });

        if (res.error) {
          toast.error(res.error);
        }
      } catch {
        toast.error("Failed to save notes.");
      } finally {
        setLocalItems((s) => ({
          ...s,
          [itemId]: { ...s[itemId], saving: false },
        }));
      }
    },
    [isEditable, localItems]
  );

  const resultButtons: {
    value: ResultType;
    label: string;
    icon: React.ReactNode;
    activeClass: string;
  }[] = [
    {
      value: "verified",
      label: "Verified",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      activeClass:
        "bg-green-500 text-white border-green-500 shadow-sm shadow-green-500/20",
    },
    {
      value: "missing",
      label: "Missing",
      icon: <XCircle className="h-3.5 w-3.5" />,
      activeClass:
        "bg-red-500 text-white border-red-500 shadow-sm shadow-red-500/20",
    },
    {
      value: "damaged",
      label: "Damaged",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      activeClass:
        "bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/20",
    },
  ];

  return (
    <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
      {/* Header with progress */}
      <div className="border-b border-border p-4 bg-muted/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Boxes className="h-4 w-4 text-primary" />
              Audit Checklist
              {isClosed && (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/10 text-[9px] uppercase font-bold ml-1.5 py-0 px-1.5">
                  Closed
                </Badge>
              )}
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {isEditable
                ? "Click a result for each asset. Notes auto-save on blur."
                : isClosed
                ? "This audit cycle is closed. Results are read-only."
                : "You are viewing this checklist as read-only."}
            </p>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-foreground">
              {checkedCount}
              <span className="text-muted-foreground font-normal">
                /{totalItems}
              </span>
            </span>
            <span className="text-[10px] text-muted-foreground block">
              checked
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Progress</span>
            <span className="font-semibold text-foreground">{pct}%</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                pct === 100 ? "bg-green-500" : "bg-primary"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Items */}
      {totalItems === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-xs">
          No assets in this audit cycle.
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {items.map((item) => {
            const local = localItems[item.id] || {
              result: "pending",
              notes: "",
              saving: false,
            };
            const showNotes =
              local.result === "missing" || local.result === "damaged";

            return (
              <div
                key={item.id}
                className={`p-4 transition-colors ${
                  local.result === "verified"
                    ? "bg-green-500/[0.02]"
                    : local.result === "missing"
                    ? "bg-red-500/[0.02]"
                    : local.result === "damaged"
                    ? "bg-amber-500/[0.02]"
                    : ""
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Asset info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Thumbnail */}
                    {item.asset?.photo_url ? (
                      <img
                        src={item.asset.photo_url}
                        alt={item.asset.name}
                        className="h-10 w-10 rounded-lg object-cover border border-border shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center border border-border shrink-0">
                        <Boxes className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {item.asset?.name || "Unknown"}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="font-mono">
                          {item.asset?.asset_tag || "—"}
                        </span>
                        {item.asset?.location && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" />
                            {item.asset.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Result segmented control */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {resultButtons.map((btn) => {
                      const isActive = local.result === btn.value;
                      return (
                        <button
                          key={btn.value}
                          type="button"
                          disabled={!isEditable || local.saving}
                          onClick={() =>
                            handleResultChange(item.id, btn.value)
                          }
                          className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide border rounded-md transition-all ${
                            isActive
                              ? btn.activeClass
                              : "border-border text-muted-foreground hover:bg-muted/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          }`}
                        >
                          {btn.icon}
                          {btn.label}
                        </button>
                      );
                    })}

                    {local.saving && (
                      <Loader2 className="h-3.5 w-3.5 text-primary animate-spin ml-1" />
                    )}
                  </div>
                </div>

                {/* Notes field — shown for missing/damaged */}
                {showNotes && (
                  <div className="mt-2.5 ml-0 sm:ml-13">
                    <Textarea
                      placeholder={
                        local.result === "missing"
                          ? "Where was this asset last seen? Any details..."
                          : "Describe the damage observed..."
                      }
                      value={local.notes}
                      onChange={(e) =>
                        setLocalItems((s) => ({
                          ...s,
                          [item.id]: { ...s[item.id], notes: e.target.value },
                        }))
                      }
                      onBlur={() => handleNotesBlur(item.id)}
                      disabled={!isEditable}
                      className="text-xs min-h-[60px] resize-none"
                    />
                  </div>
                )}

                {/* Show read-only notes for closed cycles */}
                {isClosed && item.notes && !showNotes && (
                  <div className="mt-2 ml-0 sm:ml-13">
                    <p className="text-[10px] text-muted-foreground italic">
                      Notes: {item.notes}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
