import type { UserRole } from "@/lib/types";

// Pure permission functions matching architecture.md 2.1 permission matrix.
// Consumed in both server actions (authoritative check) and UI (conditional rendering).

/** Manage departments, categories, employee directory (admin only) */
export function canManageOrgSetup(role: UserRole): boolean {
  return role === "admin";
}

/** Register new assets (admin, asset_manager) */
export function canRegisterAssets(role: UserRole): boolean {
  return role === "admin" || role === "asset_manager";
}

/** Allocate / return assets (admin, asset_manager) */
export function canAllocateAssets(role: UserRole): boolean {
  return role === "admin" || role === "asset_manager";
}

/** Approve transfer requests (admin, asset_manager, or dept head for own department) */
export function canApproveTransfer(
  role: UserRole,
  isOwnDepartment: boolean = false
): boolean {
  if (role === "admin" || role === "asset_manager") return true;
  if (role === "department_head" && isOwnDepartment) return true;
  return false;
}

/** Approve/reject maintenance requests (admin, asset_manager) */
export function canApproveMaintenance(role: UserRole): boolean {
  return role === "admin" || role === "asset_manager";
}

/** Create / close audit cycles (admin only) */
export function canCreateAuditCycle(role: UserRole): boolean {
  return role === "admin";
}

/** Act as auditor in audit cycles (admin, asset_manager if assigned, dept head if assigned) */
export function canActAsAuditor(role: UserRole): boolean {
  return (
    role === "admin" ||
    role === "asset_manager" ||
    role === "department_head"
  );
}

/** View org-wide reports (admin, asset_manager; dept head sees own dept only) */
export function canViewOrgWideReports(role: UserRole): boolean {
  return (
    role === "admin" ||
    role === "asset_manager" ||
    role === "department_head"
  );
}

/** Promote employees to other roles (admin only) */
export function canPromoteEmployees(role: UserRole): boolean {
  return role === "admin";
}

/** View audits section (admin, asset_manager, department_head) */
export function canViewAudits(role: UserRole): boolean {
  return (
    role === "admin" ||
    role === "asset_manager" ||
    role === "department_head"
  );
}
