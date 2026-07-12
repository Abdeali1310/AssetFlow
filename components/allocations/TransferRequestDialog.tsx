"use client";

import React, { useState, useEffect, useTransition } from "react";
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
import { requestTransfer } from "@/lib/actions/allocations";
import { getEmployees } from "@/lib/actions/employees";
import { User, Search, X, Check, FileText } from "lucide-react";

interface TransferRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string;
  assetTag: string;
  assetName: string;
  prefilledEmployeeId?: string;
}

export function TransferRequestDialog({
  open,
  onOpenChange,
  assetId,
  assetTag,
  assetName,
  prefilledEmployeeId,
}: TransferRequestDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Selected employee target
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string>("");

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  const [reason, setReason] = useState("");

  // Data stores
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch employees
  useEffect(() => {
    if (!open) return;

    setSelectedEmployeeId("");
    setSelectedEmployeeName("");
    setSearchQuery("");
    setReason("");

    async function loadData() {
      setIsLoading(true);
      try {
        const data = await getEmployees({ status: "active" });
        setEmployees(data || []);

        // Prefill if provided
        if (prefilledEmployeeId) {
          const prefilled = data.find((e) => e.id === prefilledEmployeeId);
          if (prefilled) {
            setSelectedEmployeeId(prefilled.id);
            setSelectedEmployeeName(prefilled.full_name);
          }
        }
      } catch (err) {
        toast.error("Failed to load employees");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [open, prefilledEmployeeId]);

  const filteredEmployees = employees.filter((emp) =>
    `${emp.full_name} ${emp.email} ${emp.department_name || ""}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const handleSubmit = () => {
    if (!selectedEmployeeId) {
      toast.error("Please select a target employee");
      return;
    }

    startTransition(async () => {
      try {
        const res = await requestTransfer({
          assetId,
          toEmployeeId: selectedEmployeeId,
          reason: reason || undefined,
        });

        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Transfer request submitted successfully");
          onOpenChange(false);
          router.refresh();
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to request transfer");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-full">
        <DialogHeader>
          <DialogTitle>Request Asset Transfer</DialogTitle>
          <DialogDescription>
            Propose transferring ownership of{" "}
            <span className="font-semibold text-foreground">{assetName}</span> (
            <span className="font-mono text-xs">{assetTag}</span>) to another employee.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target employee selector */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Transfer Target (New Holder)
            </label>

            {selectedEmployeeId ? (
              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 p-2.5 rounded-lg">
                <div className="flex items-center gap-2.5">
                  <div className="bg-primary/10 p-1.5 rounded-full text-primary">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">
                    {selectedEmployeeName}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setSelectedEmployeeId("");
                    setSelectedEmployeeName("");
                  }}
                  disabled={isPending}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-xs bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    disabled={isPending}
                  />
                </div>

                <div className="border border-border rounded-lg max-h-[140px] overflow-y-auto divide-y divide-border/60 bg-card">
                  {isLoading ? (
                    <div className="p-3 text-xs text-muted-foreground text-center">
                      Loading employees...
                    </div>
                  ) : filteredEmployees.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground text-center">
                      No employees found
                    </div>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <div
                        key={emp.id}
                        onClick={() => {
                          setSelectedEmployeeId(emp.id);
                          setSelectedEmployeeName(emp.full_name);
                        }}
                        className="p-2 text-xs flex items-center justify-between cursor-pointer hover:bg-muted/10 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <p className="font-semibold text-foreground">{emp.full_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {emp.email} {emp.department_name ? `· ${emp.department_name}` : ""}
                          </p>
                        </div>
                        <Check className="h-3 w-3 text-primary opacity-0" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Reason for transfer */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              Transfer Reason (Optional)
            </label>
            <Textarea
              placeholder="Provide a brief explanation for the asset transfer (e.g. employee role change, team reorganization, laptop upgrade...)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-xs min-h-[80px] focus:ring-primary focus:border-primary resize-none"
              disabled={isPending}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
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
            onClick={handleSubmit}
            disabled={isPending || !selectedEmployeeId}
          >
            {isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
