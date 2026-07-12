"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { closeAuditCycle } from "@/lib/actions/audits";
import { canCreateAuditCycle } from "@/lib/permissions";
import { AuditChecklist } from "@/components/audits/AuditChecklist";
import { DiscrepancyReport } from "@/components/audits/DiscrepancyReport";
import {
  ClipboardCheck,
  ArrowLeft,
  Calendar,
  Building2,
  MapPin,
  Users,
  Lock,
  AlertTriangle,
  UserCheck,
  Clock,
} from "lucide-react";
import type { UserRole } from "@/lib/types";

interface AuditDetailClientProps {
  cycle: any;
  currentUserRole: UserRole;
  currentUserId: string;
  isAssignedAuditor: boolean;
}

export function AuditDetailClient({
  cycle,
  currentUserRole,
  currentUserId,
  isAssignedAuditor,
}: AuditDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [closeOpen, setCloseOpen] = useState(false);

  const isAdmin = canCreateAuditCycle(currentUserRole);
  const isActive = cycle.status === "active";
  const isClosed = cycle.status === "closed";

  // Editable if: cycle is active AND (user is assigned auditor OR admin)
  const isEditable = isActive && (isAssignedAuditor || isAdmin);

  const items = cycle.items || [];
  const totalItems = items.length;
  const checkedItems = items.filter((i: any) => i.result !== "pending").length;
  const pct = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  // Count missing items for close warning
  const missingCount = items.filter((i: any) => i.result === "missing").length;

  const scopeParts: string[] = [];
  if (cycle.scope_department?.name) scopeParts.push(cycle.scope_department.name);
  if (cycle.scope_location) scopeParts.push(cycle.scope_location);
  const scopeLabel = scopeParts.length > 0 ? scopeParts.join(" · ") : "All Assets";

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      draft: {
        className: "bg-slate-500/10 text-slate-500 border-slate-500/20 hover:bg-slate-500/10",
        label: "Draft",
      },
      active: {
        className: "bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10",
        label: "Active",
      },
      closed: {
        className: "bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/10",
        label: "Closed",
      },
    };
    const c = config[status] || config.draft;
    return (
      <Badge className={`${c.className} text-[10px] uppercase font-bold py-0 px-2`}>
        {c.label}
      </Badge>
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleClose = () => {
    startTransition(async () => {
      try {
        const res = await closeAuditCycle({ auditCycleId: cycle.id });
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(
            `Audit cycle closed. ${res.missingCount} asset(s) marked as lost.`
          );
          setCloseOpen(false);
          router.refresh();
        }
      } catch {
        toast.error("Failed to close audit cycle.");
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back link */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/audits")}
        className="text-muted-foreground hover:text-foreground text-xs"
      >
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
        Back to Audits
      </Button>

      {/* Header Card */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="border-b border-border p-5 bg-muted/10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-foreground">
                  {cycle.reference}
                </span>
                {getStatusBadge(cycle.status)}
              </div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                {cycle.name}
              </h2>
            </div>

            {/* Close button — admin only, active only */}
            {isAdmin && isActive && (
              <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
                <DialogTrigger
                  render={
                    <Button variant="destructive" size="sm">
                      <Lock className="mr-1.5 h-3.5 w-3.5" />
                      Close Audit Cycle
                    </Button>
                  }
                />
                <DialogContent className="max-w-md">
                  <div className="space-y-4 p-2 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-foreground">
                          Close Audit Cycle
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                          This action <strong>cannot be undone</strong>. Closing
                          this cycle will:
                        </p>
                      </div>
                    </div>

                    <ul className="space-y-1.5 text-foreground pl-1">
                      <li className="flex items-start gap-2">
                        <span className="text-destructive font-black">•</span>
                        Mark all currently-<strong>Missing</strong> assets as{" "}
                        <strong className="text-destructive">Lost</strong>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-500 font-black">•</span>
                        Damaged assets will{" "}
                        <strong>not</strong> have their status changed
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-muted-foreground font-black">•</span>
                        Lock all audit results as read-only
                      </li>
                    </ul>

                    {missingCount > 0 ? (
                      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <p className="font-bold text-destructive text-sm">
                          {missingCount} asset{missingCount !== 1 ? "s" : ""}{" "}
                          will be marked as Lost
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <p className="font-bold text-green-600 text-sm">
                          No assets will be marked as Lost
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <DialogClose
                        render={
                          <Button variant="outline" size="sm">
                            Cancel
                          </Button>
                        }
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleClose}
                        disabled={isPending}
                      >
                        {isPending ? "Closing..." : "Close Audit Cycle"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {/* Scope */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              {cycle.scope_department?.name ? (
                <Building2 className="h-3 w-3" />
              ) : (
                <MapPin className="h-3 w-3" />
              )}
              Scope
            </span>
            <span className="font-semibold text-foreground">{scopeLabel}</span>
          </div>

          {/* Date Range */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Period
            </span>
            <span className="font-semibold text-foreground">
              {formatDate(cycle.start_date)} — {formatDate(cycle.end_date)}
            </span>
          </div>

          {/* Auditors */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Users className="h-3 w-3" />
              Auditors
            </span>
            <div className="flex flex-wrap gap-1 pt-0.5">
              {(cycle.auditors || []).map((a: any) => (
                <span
                  key={a.id}
                  className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    a.auditor_id === currentUserId
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-muted/30 text-foreground border-border"
                  }`}
                >
                  {a.auditor_id === currentUserId && (
                    <UserCheck className="h-2.5 w-2.5" />
                  )}
                  {a.auditor?.full_name || "Unknown"}
                </span>
              ))}
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Progress
            </span>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold text-foreground">
                  {checkedItems}/{totalItems} checked
                </span>
                <span className="text-muted-foreground">{pct}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    pct === 100 ? "bg-green-500" : "bg-primary"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Closed banner */}
        {isClosed && (
          <div className="border-t border-border px-5 py-3 bg-green-500/[0.03] flex items-center gap-2 text-[10px] text-green-600">
            <Lock className="h-3.5 w-3.5" />
            <span>
              Closed by{" "}
              <strong>{cycle.closer?.full_name || "Unknown"}</strong> on{" "}
              {formatDateTime(cycle.closed_at)}
            </span>
          </div>
        )}
      </div>

      {/* Audit Checklist */}
      <AuditChecklist
        items={items}
        cycleId={cycle.id}
        isEditable={isEditable}
        isClosed={isClosed}
      />

      {/* Discrepancy Report */}
      <DiscrepancyReport items={items} />
    </div>
  );
}
