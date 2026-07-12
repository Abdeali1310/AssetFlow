"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReturnDialog } from "@/components/allocations/ReturnDialog";
import { TransferRequestDialog } from "@/components/allocations/TransferRequestDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RejectDialog } from "@/components/allocations/RejectDialog";
import { approveTransfer, rejectTransfer } from "@/lib/actions/allocations";
import {
  Search,
  ArrowRightLeft,
  Calendar,
  User,
  Building,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import type { UserRole } from "@/lib/types";

interface AllocationsClientProps {
  activeAllocations: any[];
  transferRequests: any[];
  returnHistory: any[];
  currentUserRole: UserRole;
  currentUserId: string;
  currentUserDeptId: string | null;
}

export function AllocationsClient({
  activeAllocations,
  transferRequests,
  returnHistory,
  currentUserRole,
  currentUserId,
  currentUserDeptId,
}: AllocationsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Search queries
  const [allocSearch, setAllocSearch] = useState("");
  const [transferSearch, setTransferSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");

  // Transfer filter status tab
  const [transferFilter, setTransferFilter] = useState("all");

  // Selected asset / allocation state for Return dialog
  const [returnState, setReturnState] = useState<{
    open: boolean;
    allocationId: string;
    assetName: string;
    assetTag: string;
    holderName: string;
  }>({
    open: false,
    allocationId: "",
    assetName: "",
    assetTag: "",
    holderName: "",
  });

  // Selected asset / allocation state for Transfer dialog
  const [transferState, setTransferState] = useState<{
    open: boolean;
    assetId: string;
    assetName: string;
    assetTag: string;
  }>({
    open: false,
    assetId: "",
    assetName: "",
    assetTag: "",
  });

  // Approve action modal state
  const [approveConfirm, setApproveConfirm] = useState<{
    open: boolean;
    requestId: string;
    assetName: string;
  }>({
    open: false,
    requestId: "",
    assetName: "",
  });

  // Reject action modal state
  const [rejectConfirm, setRejectConfirm] = useState<{
    open: boolean;
    requestId: string;
    assetName: string;
  }>({
    open: false,
    requestId: "",
    assetName: "",
  });

  // Check if current user role is manager/admin
  const isManager = currentUserRole === "admin" || currentUserRole === "asset_manager";

  // Check if current user is allowed to approve/reject a transfer
  const canApprove = (req: any) => {
    if (isManager) return true;
    if (currentUserRole === "department_head") {
      return (
        req.from_employee?.department_id &&
        req.from_employee.department_id === currentUserDeptId
      );
    }
    return false;
  };

  // Check if overdue helper
  const checkIsOverdue = (dateStr: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  // Format date helper
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Filter Active Allocations
  const filteredAllocations = activeAllocations.filter((alloc) => {
    const holderName = alloc.employee_name || alloc.department_name || "";
    const assetName = alloc.asset?.name || "";
    const assetTag = alloc.asset?.asset_tag || "";
    return `${holderName} ${assetName} ${assetTag}`
      .toLowerCase()
      .includes(allocSearch.toLowerCase());
  });

  // Filter Transfer Requests
  const filteredTransfers = transferRequests.filter((req) => {
    const fromName = req.from_employee?.full_name || "";
    const toName = req.to_employee?.full_name || "";
    const reqName = req.requester?.full_name || "";
    const assetName = req.asset?.name || "";
    const assetTag = req.asset?.asset_tag || "";
    const matchesSearch = `${fromName} ${toName} ${reqName} ${assetName} ${assetTag}`
      .toLowerCase()
      .includes(transferSearch.toLowerCase());

    const matchesStatus =
      transferFilter === "all" ||
      (transferFilter === "requested" && req.status === "requested") ||
      (transferFilter === "approved" && req.status === "approved") ||
      (transferFilter === "rejected" && req.status === "rejected");

    return matchesSearch && matchesStatus;
  });

  // Filter Return History
  const filteredHistory = returnHistory.filter((hist) => {
    const holderName = hist.employee?.full_name || hist.department?.name || "";
    const assetName = hist.asset?.name || "";
    const assetTag = hist.asset?.asset_tag || "";
    const notes = hist.return_condition_notes || "";
    return `${holderName} ${assetName} ${assetTag} ${notes}`
      .toLowerCase()
      .includes(historySearch.toLowerCase());
  });

  // Approve action handler
  const handleApproveSubmit = () => {
    if (!approveConfirm.requestId) return;

    startTransition(async () => {
      try {
        const res = await approveTransfer({
          transferRequestId: approveConfirm.requestId,
        });

        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Transfer approved and asset successfully re-allocated");
          setApproveConfirm((prev) => ({ ...prev, open: false }));
          router.refresh();
        }
      } catch (err: any) {
        toast.error("Failed to approve transfer");
      }
    });
  };

  // Reject action handler
  const handleRejectSubmit = (reason: string) => {
    if (!rejectConfirm.requestId) return;

    startTransition(async () => {
      try {
        const res = await rejectTransfer({
          transferRequestId: rejectConfirm.requestId,
          reason,
        });

        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Transfer request rejected");
          setRejectConfirm((prev) => ({ ...prev, open: false }));
          router.refresh();
        }
      } catch (err: any) {
        toast.error("Failed to reject transfer");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <ArrowRightLeft className="h-6 w-6 text-primary" />
          Allocations & Transfers
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage active asset assignments, request internal ownership transfers, and review check-in return history.
        </p>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="bg-muted/40 p-1 border border-border/50 rounded-lg">
          <TabsTrigger value="active" className="text-xs gap-1.5 px-4">
            <ClipboardList className="h-3.5 w-3.5" />
            Active Allocations
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
              {activeAllocations.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="transfers" className="text-xs gap-1.5 px-4">
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Transfer Requests
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
              {transferRequests.filter((t) => t.status === "requested").length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1.5 px-4">
            <RotateCcw className="h-3.5 w-3.5" />
            Return History
          </TabsTrigger>
        </TabsList>

        {/* Tab: Active Allocations */}
        <TabsContent value="active" className="space-y-4 mt-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by asset, tag, or holder name..."
              value={allocSearch}
              onChange={(e) => setAllocSearch(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="w-[240px] text-xs font-bold">Asset</TableHead>
                  <TableHead className="text-xs font-bold">Current Holder</TableHead>
                  <TableHead className="text-xs font-bold">Allocated Date</TableHead>
                  <TableHead className="text-xs font-bold">Expected Return</TableHead>
                  <TableHead className="text-right text-xs font-bold pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAllocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-xs text-muted-foreground">
                      No active allocations found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAllocations.map((alloc) => {
                    const isOverdue = checkIsOverdue(alloc.expected_return_date);
                    const holderName = alloc.employee_name || alloc.department_name || "Employee";
                    const isDept = !!alloc.department_id;

                    return (
                      <TableRow key={alloc.id} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="py-3">
                          <Link
                            href={`/assets/${alloc.asset_id}`}
                            className="group flex items-center gap-1.5 font-semibold text-xs text-foreground hover:text-primary transition-colors"
                          >
                            {alloc.asset?.name}
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary transition-all" />
                          </Link>
                          <span className="font-mono text-[10px] text-muted-foreground block mt-0.5">
                            {alloc.asset?.asset_tag}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <div className={`p-1 rounded-full ${isDept ? "bg-indigo-500/10 text-indigo-500" : "bg-primary/10 text-primary"}`}>
                              {isDept ? (
                                <Building className="h-3.5 w-3.5" />
                              ) : (
                                <User className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <span className="text-xs font-medium text-foreground">
                              {holderName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-xs text-muted-foreground">
                          {formatDate(alloc.allocated_at)}
                        </TableCell>
                        <TableCell className={`py-3 text-xs font-medium ${isOverdue ? "text-destructive flex items-center gap-1 mt-0.5" : "text-muted-foreground"}`}>
                          {isOverdue && <Clock className="h-3.5 w-3.5 animate-pulse" />}
                          {formatDate(alloc.expected_return_date)}
                          {isOverdue && <span className="text-[10px] uppercase font-bold tracking-wider">(Overdue)</span>}
                        </TableCell>
                        <TableCell className="py-3 text-right pr-6 space-x-1.5">
                          {/* Return button (Manager only) */}
                          {isManager && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() =>
                                setReturnState({
                                  open: true,
                                  allocationId: alloc.id,
                                  assetName: alloc.asset?.name || "",
                                  assetTag: alloc.asset?.asset_tag || "",
                                  holderName,
                                })
                              }
                            >
                              Return
                            </Button>
                          )}

                          {/* Request Transfer button (Any employee targets, except department targets) */}
                          {!isDept && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() =>
                                setTransferState({
                                  open: true,
                                  assetId: alloc.asset_id,
                                  assetName: alloc.asset?.name || "",
                                  assetTag: alloc.asset?.asset_tag || "",
                                })
                              }
                            >
                              Request Transfer
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab: Transfer Requests */}
        <TabsContent value="transfers" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={transferSearch}
                onChange={(e) => setTransferSearch(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex bg-muted/30 p-0.5 rounded-lg border border-border/60 text-xs self-start sm:self-auto">
              {[
                { value: "all", label: "All" },
                { value: "requested", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setTransferFilter(tab.value)}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    transferFilter === tab.value
                      ? "bg-background text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="w-[180px] text-xs font-bold">Asset</TableHead>
                  <TableHead className="text-xs font-bold">From</TableHead>
                  <TableHead className="text-xs font-bold">To</TableHead>
                  <TableHead className="text-xs font-bold">Requested By</TableHead>
                  <TableHead className="text-xs font-bold">Status</TableHead>
                  <TableHead className="text-xs font-bold">Date</TableHead>
                  <TableHead className="text-right text-xs font-bold pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-xs text-muted-foreground">
                      No transfer requests found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransfers.map((req) => {
                    const fromName = req.from_employee?.full_name || "Unknown";
                    const toName = req.to_employee?.full_name || "Unknown";
                    const reqName = req.requester?.full_name || "Requester";
                    const userCanApprove = canApprove(req);

                    return (
                      <TableRow key={req.id} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="py-3">
                          <Link
                            href={`/assets/${req.asset_id}`}
                            className="group flex items-center gap-1.5 font-semibold text-xs text-foreground hover:text-primary transition-colors"
                          >
                            {req.asset?.name}
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary transition-all" />
                          </Link>
                          <span className="font-mono text-[10px] text-muted-foreground block mt-0.5">
                            {req.asset?.asset_tag}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-xs text-foreground">
                          {fromName}
                        </TableCell>
                        <TableCell className="py-3 text-xs font-medium text-foreground">
                          {toName}
                        </TableCell>
                        <TableCell className="py-3 text-xs text-muted-foreground">
                          {reqName}
                        </TableCell>
                        <TableCell className="py-3">
                          {req.status === "requested" && (
                            <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/10 flex items-center gap-1 w-fit text-[10px] font-semibold py-0 px-2">
                              <Clock className="h-3 w-3" /> Pending
                            </Badge>
                          )}
                          {req.status === "approved" && (
                            <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/10 flex items-center gap-1 w-fit text-[10px] font-semibold py-0 px-2">
                              <CheckCircle2 className="h-3 w-3" /> Approved
                            </Badge>
                          )}
                          {req.status === "rejected" && (
                            <Badge
                              className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/10 flex items-center gap-1 w-fit text-[10px] font-semibold py-0 px-2 cursor-help"
                              title={req.rejection_reason || "No reason provided"}
                            >
                              <XCircle className="h-3 w-3" /> Rejected
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-xs text-muted-foreground">
                          {formatDate(req.created_at)}
                        </TableCell>
                        <TableCell className="py-3 text-right pr-6 space-x-1.5">
                          {req.status === "requested" && (
                            <>
                              {userCanApprove ? (
                                <>
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    onClick={() =>
                                      setApproveConfirm({
                                        open: true,
                                        requestId: req.id,
                                        assetName: req.asset?.name || "",
                                      })
                                    }
                                    className="bg-green-500/5 text-green-600 border-green-500/30 hover:bg-green-500/10 hover:text-green-700"
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    onClick={() =>
                                      setRejectConfirm({
                                        open: true,
                                        requestId: req.id,
                                        assetName: req.asset?.name || "",
                                      })
                                    }
                                    className="bg-destructive/5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive-foreground"
                                  >
                                    Reject
                                  </Button>
                                </>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1 select-none py-0.5">
                                  <ShieldCheck className="h-3 w-3 text-muted-foreground/60" /> Requires Manager
                                </Badge>
                              )}
                            </>
                          )}

                          {req.status !== "requested" && (
                            <span className="text-[11px] text-muted-foreground italic">Processed</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab: Return History */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search return history..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="w-[200px] text-xs font-bold">Asset</TableHead>
                  <TableHead className="text-xs font-bold">Was Held By</TableHead>
                  <TableHead className="text-xs font-bold">Allocated Date</TableHead>
                  <TableHead className="text-xs font-bold">Returned Date</TableHead>
                  <TableHead className="text-xs font-bold">Reason</TableHead>
                  <TableHead className="w-[240px] text-xs font-bold pr-6">Check-in Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-xs text-muted-foreground">
                      No return history records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistory.map((hist) => {
                    const holderName = hist.employee?.full_name || hist.department?.name || "Employee";
                    const isDept = !!hist.department_id;

                    return (
                      <TableRow key={hist.id} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="py-3">
                          <Link
                            href={`/assets/${hist.asset_id}`}
                            className="group flex items-center gap-1.5 font-semibold text-xs text-foreground hover:text-primary transition-colors"
                          >
                            {hist.asset?.name}
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary transition-all" />
                          </Link>
                          <span className="font-mono text-[10px] text-muted-foreground block mt-0.5">
                            {hist.asset?.asset_tag}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <div className={`p-0.5 rounded-full ${isDept ? "bg-indigo-500/10 text-indigo-500" : "bg-primary/10 text-primary"}`}>
                              {isDept ? (
                                <Building className="h-3 w-3" />
                              ) : (
                                <User className="h-3 w-3" />
                              )}
                            </div>
                            <span className="text-xs text-foreground">
                              {holderName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-xs text-muted-foreground">
                          {formatDate(hist.allocated_at)}
                        </TableCell>
                        <TableCell className="py-3 text-xs text-foreground font-semibold">
                          {formatDate(hist.returned_at)}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge variant="outline" className="text-[10px] font-semibold py-0 px-2 capitalize">
                            {hist.return_reason || "returned"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-xs text-muted-foreground pr-6 truncate max-w-[240px]" title={hist.return_condition_notes || ""}>
                          {hist.return_condition_notes || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Return Dialog wrapper */}
      <ReturnDialog
        open={returnState.open}
        onOpenChange={(op) => setReturnState((prev) => ({ ...prev, open: op }))}
        allocationId={returnState.allocationId}
        assetName={returnState.assetName}
        assetTag={returnState.assetTag}
        holderName={returnState.holderName}
      />

      {/* Transfer Request Dialog wrapper */}
      <TransferRequestDialog
        open={transferState.open}
        onOpenChange={(op) => setTransferState((prev) => ({ ...prev, open: op }))}
        assetId={transferState.assetId}
        assetTag={transferState.assetTag}
        assetName={transferState.assetName}
      />

      {/* Approve Confirm dialog */}
      <ConfirmDialog
        open={approveConfirm.open}
        onOpenChange={(op) => setApproveConfirm((prev) => ({ ...prev, open: op }))}
        title="Approve Asset Transfer"
        description={`Are you sure you want to approve the internal transfer request for asset "${approveConfirm.assetName}"? This will close the previous employee allocation and assign ownership to the transfer recipient.`}
        onConfirm={handleApproveSubmit}
        confirmText={isPending ? "Approving..." : "Approve Transfer"}
      />

      {/* Reject reason dialog */}
      <RejectDialog
        open={rejectConfirm.open}
        onOpenChange={(op) => setRejectConfirm((prev) => ({ ...prev, open: op }))}
        title="Reject Asset Transfer"
        description={`Provide a reason for rejecting the transfer request for asset "${rejectConfirm.assetName}".`}
        onConfirm={handleRejectSubmit}
        isPending={isPending}
      />
    </div>
  );
}
