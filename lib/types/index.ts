// ---------- ENUM TYPES (string literal unions matching DB enums) ----------

export type UserRole = "admin" | "asset_manager" | "department_head" | "employee";

export type UserStatus = "active" | "inactive";

export type DepartmentStatus = "active" | "inactive";

export type AssetStatus =
  | "available"
  | "allocated"
  | "reserved"
  | "under_maintenance"
  | "lost"
  | "retired"
  | "disposed";

export type AssetCondition = "new" | "good" | "fair" | "poor" | "damaged";

export type AllocationStatus = "active" | "returned";

export type TransferStatus = "requested" | "approved" | "rejected";

export type BookingStatus = "upcoming" | "ongoing" | "completed" | "cancelled";

export type MaintenanceStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "technician_assigned"
  | "in_progress"
  | "resolved";

export type MaintenancePriority = "low" | "medium" | "high" | "critical";

export type AuditCycleStatus = "draft" | "active" | "closed";

export type AuditItemResult = "pending" | "verified" | "missing" | "damaged";

// ---------- TABLE INTERFACES (matching DB schema in architecture.md 6) ----------

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  department_id: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: UserStatus;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  parent_department_id: string | null;
  head_id: string | null;
  status: DepartmentStatus;
  created_at: string;
  // Joined fields (not in DB, populated by queries)
  head_name?: string;
  parent_department_name?: string;
}

export interface AssetCategory {
  id: string;
  name: string;
  description: string | null;
  custom_fields: CustomFieldDefinition[];
  created_at: string;
}

export interface CustomFieldDefinition {
  key: string;
  label: string;
  type: "text" | "number" | "date";
}

export interface Asset {
  id: string;
  asset_tag: string;
  name: string;
  category_id: string | null;
  serial_number: string | null;
  qr_code: string | null;
  acquisition_date: string | null;
  acquisition_cost: number | null;
  condition: AssetCondition;
  location: string | null;
  department_id: string | null;
  is_bookable: boolean;
  status: AssetStatus;
  photo_url: string | null;
  documents: Record<string, unknown>[];
  custom_field_values: Record<string, unknown>;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  category_name?: string;
  department_name?: string;
  current_holder_name?: string;
  current_allocation_id?: string;
}

export interface AssetAllocation {
  id: string;
  asset_id: string;
  employee_id: string | null;
  department_id: string | null;
  allocated_by: string;
  allocated_at: string;
  expected_return_date: string | null;
  returned_at: string | null;
  return_condition_notes: string | null;
  status: AllocationStatus;
  return_reason: string | null;
  created_at: string;
  // Joined fields
  asset_name?: string;
  asset_tag?: string;
  employee_name?: string;
  department_name?: string;
  allocated_by_name?: string;
}

export interface TransferRequest {
  id: string;
  asset_id: string;
  from_employee_id: string | null;
  to_employee_id: string;
  requested_by: string;
  reason: string | null;
  status: TransferStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  // Joined fields
  asset_name?: string;
  asset_tag?: string;
  from_employee_name?: string;
  to_employee_name?: string;
  requested_by_name?: string;
  approved_by_name?: string;
}

export interface Booking {
  id: string;
  reference: string;
  asset_id: string;
  booked_by: string;
  department_id: string | null;
  purpose: string | null;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  cancelled_reason: string | null;
  created_at: string;
  // Joined fields
  asset_name?: string;
  asset_tag?: string;
  booked_by_name?: string;
  department_name?: string;
}

export interface MaintenanceRequest {
  id: string;
  reference: string;
  asset_id: string;
  raised_by: string;
  issue_description: string;
  priority: MaintenancePriority;
  photo_url: string | null;
  status: MaintenanceStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  technician_name: string | null;
  technician_contact: string | null;
  assigned_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  // Joined fields
  asset_name?: string;
  asset_tag?: string;
  raised_by_name?: string;
  approved_by_name?: string;
}

export interface AuditCycle {
  id: string;
  reference: string;
  name: string;
  scope_department_id: string | null;
  scope_location: string | null;
  start_date: string;
  end_date: string;
  status: AuditCycleStatus;
  created_by: string;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  // Joined fields
  scope_department_name?: string;
  created_by_name?: string;
  closed_by_name?: string;
}

export interface AuditCycleAuditor {
  id: string;
  audit_cycle_id: string;
  auditor_id: string;
  // Joined fields
  auditor_name?: string;
}

export interface AuditItem {
  id: string;
  audit_cycle_id: string;
  asset_id: string;
  result: AuditItemResult;
  notes: string | null;
  audited_by: string | null;
  audited_at: string | null;
  // Joined fields
  asset_name?: string;
  asset_tag?: string;
  audited_by_name?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  type: string;
  related_type: string | null;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  // Joined fields
  actor_name?: string;
}

// ---------- SERVER ACTION RESULT TYPE ----------

export type ActionResult<T = void> =
  | { data: T; error?: never }
  | { data?: never; error: { code: string; message: string; meta?: Record<string, unknown> } };
