"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { promoteEmployee } from "@/lib/actions/employees";
import type { UserRole } from "@/lib/types";

interface PromoteRoleDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    full_name: string;
    role: UserRole;
  } | null;
  onSuccess: () => void;
}

const roles: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Administrator" },
  { value: "asset_manager", label: "Asset Manager" },
  { value: "department_head", label: "Department Head" },
  { value: "employee", label: "Employee" },
];

function getRoleLabel(role: UserRole): string {
  return roles.find((r) => r.value === role)?.label ?? role;
}

export function PromoteRoleDialog({
  isOpen,
  onOpenChange,
  employee,
  onSuccess,
}: PromoteRoleDialogProps) {
  const [newRole, setNewRole] = useState<UserRole>("employee");
  const [isPending, setIsPending] = useState(false);

  // Sync newRole when selected employee changes
  useEffect(() => {
    if (employee) {
      setNewRole(employee.role);
    }
  }, [employee]);

  if (!employee) return null;

  async function handlePromote() {
    if (!employee) return;
    setIsPending(true);
    const res = await promoteEmployee(employee.id, newRole);
    setIsPending(false);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success(`Updated role for ${employee.full_name}`);
    onSuccess();
    onOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Change Role</DialogTitle>
          <DialogDescription>
            Change authorization access level for this employee.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1">
            <Label>Employee Name</Label>
            <p className="text-sm font-medium text-foreground">
              {employee.full_name}
            </p>
          </div>

          <div className="space-y-1">
            <Label>Current Role</Label>
            <p className="text-sm text-muted-foreground">
              {getRoleLabel(employee.role)}
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="role-select">New Role</Label>
            <select
              id="role-select"
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            This changes what {employee.full_name} can access in AssetFlow immediately.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handlePromote} disabled={isPending}>
            {isPending ? "Updating..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
