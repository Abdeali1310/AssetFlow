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
import { allocateAsset } from "@/lib/actions/allocations";
import { getEmployees } from "@/lib/actions/employees";
import { getDepartments } from "@/lib/actions/departments";
import {
  User,
  Building,
  Calendar,
  AlertCircle,
  Search,
  Check,
  X,
  ArrowRightLeft,
} from "lucide-react";

interface AllocateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string;
  assetTag: string;
  assetName: string;
  onOpenTransferRequest?: (assetId: string, targetEmployeeId: string) => void;
}

export function AllocateDialog({
  open,
  onOpenChange,
  assetId,
  assetTag,
  assetName,
  onOpenTransferRequest,
}: AllocateDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Target Type: 'employee' | 'department'
  const [targetType, setTargetType] = useState<"employee" | "department">("employee");

  // Selection states
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string>("");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [selectedDeptName, setSelectedDeptName] = useState<string>("");

  // Search filter query
  const [searchQuery, setSearchQuery] = useState("");

  // Expected return date
  const [expectedReturnDate, setExpectedReturnDate] = useState("");

  // Data stores
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Conflict Info state
  const [conflictInfo, setConflictInfo] = useState<{
    heldByName: string;
    allocationId: string;
  } | null>(null);

  // Fetch active employees and departments
  useEffect(() => {
    if (!open) return;
    
    // Reset state on open
    setTargetType("employee");
    setSelectedEmployeeId("");
    setSelectedEmployeeName("");
    setSelectedDeptId("");
    setSelectedDeptName("");
    setSearchQuery("");
    setExpectedReturnDate("");
    setConflictInfo(null);

    async function loadData() {
      setIsLoading(true);
      try {
        const [empData, deptData] = await Promise.all([
          getEmployees({ status: "active" }),
          getDepartments(),
        ]);
        setEmployees(empData || []);
        // Only active departments
        setDepartments((deptData || []).filter((d) => d.status === "active"));
      } catch (err) {
        toast.error("Failed to load employees or departments");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [open]);

  const filteredEmployees = employees.filter((emp) =>
    `${emp.full_name} ${emp.email} ${emp.department_name || ""}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const filteredDepartments = departments.filter((dept) =>
    `${dept.name} ${dept.code}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAllocate = () => {
    const employeeId = targetType === "employee" ? selectedEmployeeId : null;
    const departmentId = targetType === "department" ? selectedDeptId : null;

    if (targetType === "employee" && !employeeId) {
      toast.error("Please select an employee");
      return;
    }

    if (targetType === "department" && !departmentId) {
      toast.error("Please select a department");
      return;
    }

    startTransition(async () => {
      try {
        const res = await allocateAsset({
          assetId,
          employeeId,
          departmentId,
          expectedReturnDate: expectedReturnDate || null,
        });

        if (res.error) {
          if (res.error.code === "ALREADY_ALLOCATED" && res.error.meta) {
            setConflictInfo({
              heldByName: res.error.meta.heldByName,
              allocationId: res.error.meta.allocationId,
            });
          } else {
            toast.error(res.error.message || "Failed to allocate asset");
          }
        } else {
          toast.success(
            `Asset allocated successfully to ${
              targetType === "employee" ? selectedEmployeeName : selectedDeptName
            }`
          );
          onOpenChange(false);
          router.refresh();
        }
      } catch (err: any) {
        toast.error(err.message || "An unexpected error occurred");
      }
    });
  };

  const handleInitiateTransfer = () => {
    if (!selectedEmployeeId) return;
    // Close allocate dialog and open transfer dialog
    onOpenChange(false);
    if (onOpenTransferRequest) {
      onOpenTransferRequest(assetId, selectedEmployeeId);
    } else {
      toast.info("Transfer request flow is initiated.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-full">
        <DialogHeader>
          <DialogTitle>Allocate Asset</DialogTitle>
          <DialogDescription>
            Assign <span className="font-semibold text-foreground">{assetName}</span> (
            <span className="font-mono text-xs">{assetTag}</span>) to an employee or
            department.
          </DialogDescription>
        </DialogHeader>

        {conflictInfo ? (
          /* CONFLICT UI STATE */
          <div className="space-y-4 py-3">
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-warning-foreground">
                  Asset Already Allocated
                </h4>
                <p className="text-xs text-muted-foreground">
                  This asset is currently held by{" "}
                  <span className="font-semibold text-foreground">
                    {conflictInfo.heldByName}
                  </span>
                  . You cannot allocate it directly until it is returned.
                </p>
              </div>
            </div>

            <div className="bg-muted/30 border rounded-lg p-4 space-y-3">
              <p className="text-xs text-foreground/80 leading-relaxed">
                Would you like to send a <strong>Transfer Request</strong> to transfer this
                asset from {conflictInfo.heldByName} to{" "}
                {targetType === "employee" ? selectedEmployeeName : selectedDeptName}?
              </p>
              {targetType === "department" && (
                <p className="text-[11px] text-destructive">
                  Note: Transfer requests can only be raised for employee targets.
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConflictInfo(null)}
                disabled={isPending}
              >
                Back
              </Button>
              {targetType === "employee" && (
                <Button
                  size="sm"
                  onClick={handleInitiateTransfer}
                  className="gap-1.5"
                  disabled={isPending}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  Send Transfer Request Instead
                </Button>
              )}
            </DialogFooter>
          </div>
        ) : (
          /* STANDARD FORM UI STATE */
          <div className="space-y-4 py-2">
            {/* Allocation Target Radio selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Allocation Target
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTargetType("employee");
                    setSearchQuery("");
                  }}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                    targetType === "employee"
                      ? "bg-primary/5 border-primary text-primary shadow-sm"
                      : "bg-background border-border text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                  }`}
                >
                  <User className="h-4 w-4" />
                  Employee
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetType("department");
                    setSearchQuery("");
                  }}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                    targetType === "department"
                      ? "bg-primary/5 border-primary text-primary shadow-sm"
                      : "bg-background border-border text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                  }`}
                >
                  <Building className="h-4 w-4" />
                  Department
                </button>
              </div>
            </div>

            {/* Selection display or Search filter */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                {targetType === "employee" ? "Select Employee" : "Select Department"}
              </label>

              {/* Show selected item or search box */}
              {targetType === "employee" && selectedEmployeeId ? (
                <div className="flex items-center justify-between bg-muted/40 border border-border p-2.5 rounded-lg">
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
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : targetType === "department" && selectedDeptId ? (
                <div className="flex items-center justify-between bg-muted/40 border border-border p-2.5 rounded-lg">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-primary/10 p-1.5 rounded-full text-primary">
                      <Building className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-foreground">
                      {selectedDeptName}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => {
                      setSelectedDeptId("");
                      setSelectedDeptName("");
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                /* Search list dropdown box */
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder={`Search ${
                        targetType === "employee" ? "employees..." : "departments..."
                      }`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-xs bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div className="border border-border rounded-lg max-h-[160px] overflow-y-auto divide-y divide-border/60 bg-card">
                    {isLoading ? (
                      <div className="p-3 text-xs text-muted-foreground text-center">
                        Loading options...
                      </div>
                    ) : targetType === "employee" ? (
                      filteredEmployees.length === 0 ? (
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
                              <p className="font-semibold text-foreground">
                                {emp.full_name}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {emp.email} {emp.department_name ? `· ${emp.department_name}` : ""}
                              </p>
                            </div>
                            <Check className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100" />
                          </div>
                        ))
                      )
                    ) : filteredDepartments.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground text-center">
                        No departments found
                      </div>
                    ) : (
                      filteredDepartments.map((dept) => (
                        <div
                          key={dept.id}
                          onClick={() => {
                            setSelectedDeptId(dept.id);
                            setSelectedDeptName(dept.name);
                          }}
                          className="p-2 text-xs flex items-center justify-between cursor-pointer hover:bg-muted/10 transition-colors"
                        >
                          <div className="space-y-0.5">
                            <p className="font-semibold text-foreground">{dept.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              Code: {dept.code}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Expected Return Date (optional) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Expected Return Date (Optional)
              </label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="date"
                  value={expectedReturnDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
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
                onClick={handleAllocate}
                disabled={
                  isPending ||
                  (targetType === "employee" && !selectedEmployeeId) ||
                  (targetType === "department" && !selectedDeptId)
                }
              >
                {isPending ? "Allocating..." : "Allocate Asset"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
