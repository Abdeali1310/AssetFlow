"use client";

import React, { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Edit2,
  Calendar,
  Wrench,
  Package,
  MapPin,
  Building,
  Activity,
  User,
  Check,
  Copy,
  PlusCircle,
  XCircle,
  Archive,
  RefreshCw,
  FolderOpen,
  History as HistoryIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { AssetStatusBadge } from "@/components/assets/AssetStatusBadge";
import { AssetForm } from "@/components/assets/AssetForm";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { AssetHistoryTimeline } from "@/components/assets/AssetHistoryTimeline";
import { transitionAssetStatus } from "@/lib/actions/assets";
import { canRegisterAssets } from "@/lib/permissions";
import type { Asset, AssetCategory, Department, UserRole } from "@/lib/types";

interface AssetDetailClientProps {
  asset: Asset & {
    timeline?: any[];
    allocations?: any[];
    maintenance?: any[];
  };
  categories: AssetCategory[];
  departments: Department[];
  currentUserRole: UserRole;
}

export function AssetDetailClient({
  asset,
  categories,
  departments,
  currentUserRole,
}: AssetDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Edit Sheet State (auto opens if ?edit=true is in URL)
  const [isEditOpen, setIsEditOpen] = useState(searchParams.get("edit") === "true");

  // Copy Tag State
  const [copied, setCopied] = useState(false);

  // Confirm Status Dialog State
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    targetStatus: "available" | "retired" | "disposed" | null;
  }>({
    open: false,
    title: "",
    description: "",
    targetStatus: null,
  });

  const handleCopyTag = async () => {
    try {
      await navigator.clipboard.writeText(asset.asset_tag);
      setCopied(true);
      toast.success("Copied asset tag!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const handleUpdateSubmit = async (payload: any) => {
    // Dynamic import to avoid circular references/redundant imports
    const { updateAsset } = await import("@/lib/actions/assets");
    
    return new Promise<{ error?: string; id?: string }>((resolve) => {
      startTransition(async () => {
        try {
          const res = await updateAsset(asset.id, payload);
          if (res.success) {
            setIsEditOpen(false);
            toast.success("Asset updated successfully");
            router.refresh();
            resolve({ success: true, id: asset.id } as any);
          } else {
            resolve({ error: res.error || "Failed to update asset" });
          }
        } catch (err: any) {
          resolve({ error: err.message || "Failed to update asset" });
        }
      });
    });
  };

  const triggerStatusTransition = (
    target: "available" | "retired" | "disposed",
    title: string,
    description: string
  ) => {
    setConfirmState({
      open: true,
      title,
      description,
      targetStatus: target,
    });
  };

  const executeStatusTransition = () => {
    if (!confirmState.targetStatus) return;

    startTransition(async () => {
      try {
        const res = await transitionAssetStatus(asset.id, confirmState.targetStatus!);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(`Asset status updated to '${confirmState.targetStatus}'`);
          router.refresh();
        }
      } catch (err: any) {
        toast.error("Failed to update status");
      } finally {
        setConfirmState((prev) => ({ ...prev, open: false }));
      }
    });
  };

  const isManager = canRegisterAssets(currentUserRole);
  const isAdmin = currentUserRole === "admin";

  const activeAllocation = asset.allocations?.find((a: any) => a.status === "active");
  const activeMaintenance = asset.maintenance?.find(
    (m: any) => m.status === "approved" || m.status === "in_progress"
  );

  const isActiveForMaint = asset.status !== "retired" && asset.status !== "disposed";

  return (
    <div className="space-y-6">
      {/* Header breadcrumb bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              onClick={() => router.push("/assets")}
              className="hover:underline cursor-pointer"
            >
              Assets
            </span>
            <span>/</span>
            <span className="font-mono">{asset.asset_tag}</span>
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {asset.name}
            </h2>
            <AssetStatusBadge status={asset.status} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isManager && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              className="text-xs h-9 gap-1.5"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Edit Details
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Asset Details + Status Highlights + Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Info Card */}
          <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-5">
              {/* Photo Area (2 cols) */}
              <div className="md:col-span-2 bg-muted/10 border-b md:border-b-0 md:border-r border-border p-4 flex flex-col justify-center">
                {asset.photo_url ? (
                  <div className="aspect-square w-full rounded-lg overflow-hidden border border-border/80 bg-background relative group">
                    <img
                      src={asset.photo_url}
                      alt={asset.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="aspect-square w-full rounded-lg border border-dashed border-border/80 flex flex-col items-center justify-center bg-muted/20 text-muted-foreground p-6 text-center">
                    <Package className="h-12 w-12 text-muted-foreground/30 mb-2.5" />
                    <span className="text-xs font-medium">No Image Uploaded</span>
                  </div>
                )}
              </div>

              {/* Data Area (3 cols) */}
              <div className="md:col-span-3 p-6 space-y-6">
                {/* Meta details list */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Asset Tag
                    </span>
                    <button
                      onClick={handleCopyTag}
                      className="inline-flex items-center gap-1 text-xs font-mono font-bold bg-muted hover:bg-muted/80 px-2 py-0.5 rounded border border-border select-all"
                    >
                      {asset.asset_tag}
                      {copied ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Category
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                      {asset.category_name || "Uncategorized"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Condition
                    </span>
                    <span className="text-xs font-medium capitalize text-foreground/90">
                      {asset.condition}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Serial Number
                    </span>
                    <span className="text-xs font-mono text-foreground/80">
                      {asset.serial_number || "—"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Location
                    </span>
                    <span className="text-xs text-foreground/80 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      {asset.location || "—"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Home Department
                    </span>
                    <span className="text-xs text-foreground/80 flex items-center gap-1">
                      <Building className="h-3.5 w-3.5 text-muted-foreground" />
                      {asset.department_name || "None (Independent)"}
                    </span>
                  </div>
                </div>

                {/* Costs & Dates */}
                <div className="border-t border-border/80 pt-4 grid grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      Acquisition Date
                    </span>
                    <p className="text-xs font-medium text-foreground">
                      {asset.acquisition_date
                        ? new Date(asset.acquisition_date).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      Acquisition Cost
                    </span>
                    <p className="text-xs font-medium text-foreground">
                      {asset.acquisition_cost !== null && asset.acquisition_cost !== undefined
                        ? `$${Number(asset.acquisition_cost).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Field values if populated */}
            {asset.custom_field_values &&
              Object.keys(asset.custom_field_values).length > 0 && (
                <div className="border-t border-border bg-muted/10 p-5 space-y-3">
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <FolderOpen className="h-3.5 w-3.5" />
                    Additional Specifications
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(asset.custom_field_values).map(([key, val]) => (
                      <div key={key} className="space-y-0.5">
                        <span className="text-[11px] text-muted-foreground capitalize font-medium">
                          {key.replace(/_/g, " ")}
                        </span>
                        <p className="text-xs font-semibold text-foreground/90">
                          {val !== null && val !== undefined ? String(val) : "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Notes if populated */}
            {asset.notes && (
              <div className="border-t border-border p-5 space-y-1.5">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Notes
                </span>
                <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-line bg-muted/30 p-3 rounded border border-border/50">
                  {asset.notes}
                </p>
              </div>
            )}
          </div>

          {/* Allocation & Maintenance Active panels */}
          <div className="space-y-4">
            {/* Allocation Panel */}
            {asset.status === "allocated" && asset.current_holder_name && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3.5 shadow-sm">
                <div className="p-2 bg-primary/10 rounded-full text-primary shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    Currently Allocated
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    This asset is currently in active possession of{" "}
                    <span className="font-semibold text-foreground">
                      {asset.current_holder_name}
                    </span>
                    .
                  </p>
                  {activeAllocation && (
                    <div className="text-[10.5px] text-muted-foreground pt-1 space-y-0.5">
                      <p>
                        Allocated:{" "}
                        {new Date(activeAllocation.allocated_at).toLocaleDateString()}
                      </p>
                      {activeAllocation.expected_return_date && (
                        <p>
                          Expected Return:{" "}
                          {new Date(activeAllocation.expected_return_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Maintenance Panel */}
            {asset.status === "under_maintenance" && (
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 flex items-start gap-3.5 shadow-sm">
                <div className="p-2 bg-destructive/10 rounded-full text-destructive shrink-0">
                  <Wrench className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    Under Maintenance
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    This asset has been taken out of circulation for servicing.
                  </p>
                  {activeMaintenance && (
                    <div className="text-[10.5px] text-muted-foreground pt-1 space-y-0.5">
                      <p>
                        Maintenance Ref:{" "}
                        <span className="font-mono font-medium text-foreground">
                          {activeMaintenance.reference}
                        </span>
                      </p>
                      <p>
                        Issue: "{activeMaintenance.issue_description}"
                      </p>
                      {activeMaintenance.technician_name && (
                        <p>Technician: {activeMaintenance.technician_name}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions Panel */}
          <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Quick Actions
            </h3>

            <div className="flex flex-wrap gap-2.5">
              {/* Allocate Action (manager/admin, status=available) */}
              {isManager && asset.status === "available" && (
                <Button
                  onClick={() =>
                    toast.info("Allocation flow will be implemented in Phase 6.")
                  }
                  className="text-xs"
                >
                  <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                  Allocate Asset
                </Button>
              )}

              {/* Book Action (any role, available + bookable) */}
              {asset.status === "available" && asset.is_bookable && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/bookings/new?assetId=${asset.id}`)}
                  className="text-xs border-primary text-primary hover:bg-primary/5"
                >
                  <Calendar className="mr-1.5 h-3.5 w-3.5" />
                  Book Resource
                </Button>
              )}

              {/* Raise Maintenance (any role, status not retired/disposed) */}
              {isActiveForMaint && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/maintenance/new?assetId=${asset.id}`)}
                  className="text-xs"
                >
                  <Wrench className="mr-1.5 h-3.5 w-3.5" />
                  Request Maintenance
                </Button>
              )}

              {/* Retire Asset (manager/admin, status=available) */}
              {isManager && asset.status === "available" && (
                <Button
                  variant="outline"
                  onClick={() =>
                    triggerStatusTransition(
                      "retired",
                      "Retire Asset",
                      "Are you sure you want to retire this asset? This will take it out of available inventory and prepare it for disposal."
                    )
                  }
                  className="text-xs text-warning border-warning/30 hover:bg-warning/5 hover:text-warning"
                  disabled={isPending}
                >
                  <Archive className="mr-1.5 h-3.5 w-3.5" />
                  Retire Asset
                </Button>
              )}

              {/* Dispose Asset (manager/admin, status=retired) */}
              {isManager && asset.status === "retired" && (
                <Button
                  variant="outline"
                  onClick={() =>
                    triggerStatusTransition(
                      "disposed",
                      "Dispose Asset",
                      "Are you sure you want to permanently dispose of this asset? This action is terminal and cannot be undone."
                    )
                  }
                  className="text-xs text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                  disabled={isPending}
                >
                  <XCircle className="mr-1.5 h-3.5 w-3.5" />
                  Dispose Asset
                </Button>
              )}

              {/* Mark as Found (admin only, status=lost) */}
              {isAdmin && asset.status === "lost" && (
                <Button
                  variant="outline"
                  onClick={() =>
                    triggerStatusTransition(
                      "available",
                      "Mark Asset as Found",
                      "Confirm override: set this lost asset's status back to Available?"
                    )
                  }
                  className="text-xs text-success border-success/30 hover:bg-success/5 hover:text-success"
                  disabled={isPending}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Mark as Found
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Column: History Timeline */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-1.5">
              <HistoryIcon className="h-4 w-4 text-muted-foreground" />
              Lifecycle History
            </h3>
            <AssetHistoryTimeline timeline={asset.timeline || []} />
          </div>
        </div>
      </div>

      {/* Edit Details Sheet */}
      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-2xl w-full max-w-full">
          <SheetHeader>
            <SheetTitle>Edit Asset Specifications</SheetTitle>
            <SheetDescription>
              Modify asset attributes and values. Unique asset tag is read-only.
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 pt-0">
            <AssetForm
              initialAsset={asset}
              categories={categories}
              departments={departments}
              onSubmit={handleUpdateSubmit}
              isSubmitting={isPending}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Manual Status Transition Confirmation Modal */}
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(op) => setConfirmState((prev) => ({ ...prev, open: op }))}
        title={confirmState.title}
        description={confirmState.description}
        onConfirm={executeStatusTransition}
        confirmText={
          confirmState.targetStatus === "disposed"
            ? "Dispose Asset"
            : confirmState.targetStatus === "retired"
            ? "Retire Asset"
            : "Mark as Found"
        }
        variant={
          confirmState.targetStatus === "disposed" ? "destructive" : "default"
        }
      />
    </div>
  );
}
