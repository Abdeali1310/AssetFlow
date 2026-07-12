"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import {
  approveMaintenanceRequest,
  rejectMaintenanceRequest,
  assignTechnician,
  updateMaintenanceProgress,
} from "@/lib/actions/maintenance";
import {
  Wrench,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  User,
  Phone,
  Check,
  Bookmark,
  FileImage,
  ExternalLink,
} from "lucide-react";
import type { UserRole } from "@/lib/types";

interface MaintenanceDetailClientProps {
  request: any;
  currentUserRole: UserRole;
  currentUserId: string;
}

export function MaintenanceDetailClient({
  request,
  currentUserRole,
  currentUserId,
}: MaintenanceDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Dialog / Input States
  const [rejectReason, setRejectReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);

  const [techName, setTechName] = useState("");
  const [techContact, setTechContact] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);

  const [resNotes, setResNotes] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);

  const isManager = currentUserRole === "admin" || currentUserRole === "asset_manager";

  // Format date helper
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

  // Get status step index for tracker
  const getStatusStepIndex = (status: string) => {
    const steps = ["pending", "approved", "technician_assigned", "in_progress", "resolved"];
    return steps.indexOf(status);
  };

  const steps = [
    { label: "Pending", desc: "Reported" },
    { label: "Approved", desc: "Awaiting Tech" },
    { label: "Assigned", desc: "Tech Assigned" },
    { label: "In Progress", desc: "Repairing" },
    { label: "Resolved", desc: "Completed" },
  ];

  const currentStepIndex = getStatusStepIndex(request.status);

  // Button Action Handlers
  const handleApprove = () => {
    startTransition(async () => {
      try {
        const res = await approveMaintenanceRequest(request.id);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Maintenance request approved. Asset set to 'Under Maintenance'.");
          router.refresh();
        }
      } catch (err) {
        toast.error("Failed to approve request.");
      }
    });
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await rejectMaintenanceRequest(request.id, rejectReason);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Maintenance request rejected.");
          setRejectOpen(false);
          router.refresh();
        }
      } catch (err) {
        toast.error("Failed to reject request.");
      }
    });
  };

  const handleAssign = () => {
    if (!techName.trim()) {
      toast.error("Technician name is required.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await assignTechnician({
          requestId: request.id,
          technicianName: techName,
          technicianContact: techContact,
        });
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Technician assigned successfully.");
          setAssignOpen(false);
          router.refresh();
        }
      } catch (err) {
        toast.error("Failed to assign technician.");
      }
    });
  };

  const handleStartWork = () => {
    startTransition(async () => {
      try {
        const res = await updateMaintenanceProgress({
          requestId: request.id,
          status: "in_progress",
        });
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Work marked as in progress.");
          router.refresh();
        }
      } catch (err) {
        toast.error("Failed to start work.");
      }
    });
  };

  const handleResolve = () => {
    if (!resNotes.trim()) {
      toast.error("Please specify resolution notes.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await updateMaintenanceProgress({
          requestId: request.id,
          status: "resolved",
          resolutionNotes: resNotes,
        });
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Maintenance request resolved. Asset returned to rotation.");
          setResolveOpen(false);
          router.refresh();
        }
      } catch (err) {
        toast.error("Failed to resolve request.");
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back link */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/maintenance")}
        className="text-muted-foreground hover:text-foreground text-xs"
      >
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
        Back to Maintenance list
      </Button>

      {/* Progress tracker or Rejection banner */}
      {request.status === "rejected" ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-5 flex items-start gap-4">
          <XCircle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-xs">
            <h3 className="font-bold text-destructive text-sm uppercase tracking-wider">
              Request Rejected
            </h3>
            <p className="text-foreground leading-relaxed">
              This maintenance ticket was closed and rejected by the Asset Manager.
            </p>
            <div className="bg-background/60 p-3 rounded-lg border border-destructive/15 text-[11px] text-foreground font-mono">
              <strong className="text-destructive block mb-0.5">REJECTION REASON:</strong>
              {request.rejection_reason || "No reason specified."}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-6 shadow-xs">
          <div className="grid grid-cols-5 gap-2 relative">
            {/* Progress bar line background */}
            <div className="absolute top-4 left-[10%] right-[10%] h-0.5 bg-muted z-0 hidden sm:block" />
            <div
              className="absolute top-4 left-[10%] h-0.5 bg-primary z-0 transition-all duration-300 hidden sm:block"
              style={{
                width: `${(currentStepIndex / 4) * 80}%`,
              }}
            />

            {steps.map((step, idx) => {
              const active = idx <= currentStepIndex;
              const current = idx === currentStepIndex;

              return (
                <div key={idx} className="flex flex-col items-center text-center space-y-2 z-10">
                  <div
                    className={`h-8.5 w-8.5 rounded-full flex items-center justify-center border transition-all ${
                      current
                        ? "bg-primary text-primary-foreground border-primary ring-4 ring-primary/20 scale-105"
                        : active
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    {active && idx < currentStepIndex ? (
                      <Check className="h-4 w-4 stroke-[3px]" />
                    ) : (
                      <span className="text-xs font-black">{idx + 1}</span>
                    )}
                  </div>
                  <div className="space-y-0.5 select-none">
                    <p
                      className={`text-[10px] font-extrabold uppercase tracking-wider ${
                        active ? "text-foreground font-black" : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="text-[9px] text-muted-foreground hidden sm:block">
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main detail card */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        {/* Header */}
        <div className="border-b border-border p-5 bg-muted/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-foreground">
                {request.reference}
              </span>
              <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10 text-[10px] uppercase font-bold py-0 px-2">
                {request.priority}
              </Badge>
            </div>
            <h2 className="text-lg font-bold text-foreground">
              Maintenance for {request.asset?.name}
            </h2>
          </div>

          {/* Action buttons drawer based on role + status */}
          {isManager && (
            <div className="flex flex-wrap gap-2">
              {request.status === "pending" && (
                <>
                  <Button size="sm" onClick={handleApprove} disabled={isPending}>
                    Approve
                  </Button>

                  <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                    <DialogTrigger
                      render={
                        <Button variant="destructive" size="sm">
                          Reject
                        </Button>
                      }
                    />
                    <DialogContent className="max-w-md">
                      <div className="space-y-4 p-2 text-xs">
                        <h3 className="text-sm font-bold text-foreground">
                          Reject Maintenance Request
                        </h3>
                        <p className="text-muted-foreground">
                          Please state why this maintenance request is rejected. This will notify the reporter.
                        </p>
                        <Textarea
                          placeholder="State rejection details..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="min-h-[80px]"
                        />
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
                            onClick={handleReject}
                            disabled={isPending}
                          >
                            Submit Rejection
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}

              {request.status === "approved" && (
                <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
                  <DialogTrigger
                    render={
                      <Button size="sm">
                        Assign Technician
                      </Button>
                    }
                  />
                  <DialogContent className="max-w-md">
                    <div className="space-y-4 p-2 text-xs">
                      <h3 className="text-sm font-bold text-foreground">
                        Assign Maintenance Technician
                      </h3>
                      <p className="text-muted-foreground">
                        Provide name and contact info for the technician repairing this asset.
                      </p>
                      <div className="space-y-2">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                            Technician Name
                          </label>
                          <Input
                            placeholder="e.g. John Doe"
                            value={techName}
                            onChange={(e) => setTechName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                            Contact Info (Optional)
                          </label>
                          <Input
                            placeholder="e.g. +1 555-0199"
                            value={techContact}
                            onChange={(e) => setTechContact(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <DialogClose
                          render={
                            <Button variant="outline" size="sm">
                              Cancel
                            </Button>
                          }
                        />
                        <Button size="sm" onClick={handleAssign} disabled={isPending}>
                          Assign
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {request.status === "technician_assigned" && (
                <Button size="sm" onClick={handleStartWork} disabled={isPending}>
                  Start Work
                </Button>
              )}

              {request.status === "in_progress" && (
                <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
                  <DialogTrigger
                    render={
                      <Button size="sm">
                        Mark Resolved
                      </Button>
                    }
                  />
                  <DialogContent className="max-w-md">
                    <div className="space-y-4 p-2 text-xs">
                      <h3 className="text-sm font-bold text-foreground">
                        Resolve Maintenance Ticket
                      </h3>
                      <p className="text-muted-foreground">
                        State resolution summary details (e.g. replaced battery, calibrated display). The asset will return to circulation.
                      </p>
                      <Textarea
                        placeholder="Resolution summary notes..."
                        value={resNotes}
                        onChange={(e) => setResNotes(e.target.value)}
                        className="min-h-[90px]"
                      />
                      <div className="flex justify-end gap-2 pt-2">
                        <DialogClose
                          render={
                            <Button variant="outline" size="sm">
                              Cancel
                            </Button>
                          }
                        />
                        <Button size="sm" onClick={handleResolve} disabled={isPending}>
                          Resolve Request
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          )}
        </div>

        {/* Content detail layout split */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Left panel: Info */}
          <div className="space-y-4">
            <div className="space-y-1">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Issue Description
              </h4>
              <p className="text-foreground leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/50 font-mono text-[11px]">
                {request.issue_description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Asset ID Tag
                </span>
                <Link
                  href={`/assets/${request.asset_id}`}
                  className="font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  {request.asset?.asset_tag}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Reported By
                </span>
                <span className="font-semibold text-foreground">
                  {request.reporter?.full_name}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {request.reporter?.email}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Date Raised
                </span>
                <span className="font-semibold text-foreground">
                  {formatDateTime(request.created_at)}
                </span>
              </div>

              {request.approved_at && (
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Approved Date
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatDateTime(request.approved_at)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Assignee / Photos */}
          <div className="space-y-4 border-t md:border-t-0 md:border-l border-border/60 pt-4 md:pt-0 md:pl-6">
            {/* Technician assignment card */}
            {request.technician_name && (
              <div className="p-3 bg-muted/20 border border-border rounded-lg space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Assigned Technician
                </h4>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-foreground font-semibold">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {request.technician_name}
                  </div>
                  {request.technician_contact && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {request.technician_contact}
                    </div>
                  )}
                  {request.assigned_at && (
                    <div className="text-[9px] text-muted-foreground pt-1 border-t border-border/50">
                      Assigned: {formatDateTime(request.assigned_at)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Resolution notes card */}
            {request.status === "resolved" && (
              <div className="p-3 bg-green-500/5 border border-green-500/10 rounded-lg space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-green-600">
                  Resolution Outcome
                </h4>
                <div className="space-y-1.5 text-[11px]">
                  <p className="text-foreground italic leading-relaxed">
                    "{request.resolution_notes || "No notes provided."}"
                  </p>
                  {request.resolved_at && (
                    <div className="text-[9px] text-muted-foreground pt-1 border-t border-green-500/10">
                      Resolved: {formatDateTime(request.resolved_at)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Photo preview */}
            {request.photo_url && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <FileImage className="h-3.5 w-3.5" /> Photo Attached
                </span>
                <a
                  href={request.photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block relative rounded-lg overflow-hidden border border-border group"
                >
                  <img
                    src={request.photo_url}
                    alt="Defect Attached"
                    className="w-full h-32 object-cover group-hover:scale-102 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-[9px] font-bold text-white bg-black/60 px-2 py-1 rounded-sm">
                      View Fullsize
                    </span>
                  </div>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
