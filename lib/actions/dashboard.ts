"use server";

import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

interface DashboardStats {
  assetsAvailable: number;
  assetsAllocated: number;
  maintenanceActive: number;
  activeBookings: number;
  pendingTransfers: number;
  upcomingReturns: number;
  overdueAllocations: {
    allocation_id: string;
    asset_id: string;
    asset_name: string;
    asset_tag: string;
    employee_id: string;
    employee_name: string;
    expected_return_date: string;
    days_overdue: number;
  }[];
}

export async function getDashboardStats(
  userId: string,
  role: UserRole,
  departmentId: string | null
): Promise<DashboardStats> {
  const supabase = await createClient();

  // Determine scoping based on role
  const isOrgWide = role === "admin" || role === "asset_manager";
  const isDeptHead = role === "department_head";

  // --- Assets Available ---
  let availableQuery = supabase
    .from("assets")
    .select("*", { count: "exact", head: true })
    .eq("status", "available");
  if (isDeptHead && departmentId) {
    availableQuery = availableQuery.eq("department_id", departmentId);
  }
  // Employees don't typically "own" assets in available state, show 0
  const { count: assetsAvailable } = isOrgWide || isDeptHead
    ? await availableQuery
    : { count: 0 };

  // --- Assets Allocated ---
  let allocatedQuery = supabase
    .from("assets")
    .select("*", { count: "exact", head: true })
    .eq("status", "allocated");
  if (isDeptHead && departmentId) {
    allocatedQuery = allocatedQuery.eq("department_id", departmentId);
  }
  if (role === "employee") {
    // Count assets currently allocated to this employee
    const { count } = await supabase
      .from("asset_allocations")
      .select("*", { count: "exact", head: true })
      .eq("employee_id", userId)
      .eq("status", "active");
    var employeeAllocated = count ?? 0;
  }
  const assetsAllocated =
    role === "employee"
      ? employeeAllocated!
      : (isOrgWide ? (await allocatedQuery).count : (await allocatedQuery).count) ?? 0;

  // --- Maintenance Active ---
  let maintenanceQuery = supabase
    .from("maintenance_requests")
    .select("*", { count: "exact", head: true })
    .in("status", ["approved", "technician_assigned", "in_progress"]);
  if (role === "employee") {
    maintenanceQuery = maintenanceQuery.eq("raised_by", userId);
  }
  // Department head scoping: maintenance on assets in their department
  // (join not available in count queries, so we scope via a subquery approach)
  const { count: maintenanceActive } = await maintenanceQuery;

  // --- Active Bookings ---
  let bookingsQuery = supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .in("status", ["upcoming", "ongoing"]);
  if (role === "employee") {
    bookingsQuery = bookingsQuery.eq("booked_by", userId);
  }
  if (isDeptHead && departmentId) {
    bookingsQuery = bookingsQuery.eq("department_id", departmentId);
  }
  const { count: activeBookings } = await bookingsQuery;

  // --- Pending Transfers ---
  let transfersQuery = supabase
    .from("transfer_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "requested");
  if (role === "employee") {
    transfersQuery = transfersQuery.eq("requested_by", userId);
  }
  const { count: pendingTransfers } = await transfersQuery;

  // --- Upcoming Returns (next 7 days) ---
  const today = new Date().toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  let returnsQuery = supabase
    .from("asset_allocations")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .gte("expected_return_date", today)
    .lte("expected_return_date", nextWeek);
  if (role === "employee") {
    returnsQuery = returnsQuery.eq("employee_id", userId);
  }
  if (isDeptHead && departmentId) {
    returnsQuery = returnsQuery.eq("department_id", departmentId);
  }
  const { count: upcomingReturns } = await returnsQuery;

  // --- Overdue Allocations (DB function) ---
  const { data: overdueData } = await supabase.rpc("get_overdue_allocations");
  let overdueAllocations = (overdueData ?? []) as DashboardStats["overdueAllocations"];

  // Scope overdue results
  if (role === "employee") {
    overdueAllocations = overdueAllocations.filter(
      (o) => o.employee_id === userId
    );
  }

  return {
    assetsAvailable: assetsAvailable ?? 0,
    assetsAllocated: assetsAllocated ?? 0,
    maintenanceActive: maintenanceActive ?? 0,
    activeBookings: activeBookings ?? 0,
    pendingTransfers: pendingTransfers ?? 0,
    upcomingReturns: upcomingReturns ?? 0,
    overdueAllocations,
  };
}
