import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("--- TESTING NOTIFICATIONS & ACTIVITY LOG ACTIONS ---");

  // Fetch all profiles to check roles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, department_id");

  console.log(`Found ${profiles?.length} profiles in database.`);

  const admin = profiles?.find((p) => p.role === "admin");
  const manager = profiles?.find((p) => p.role === "asset_manager");
  const deptHead = profiles?.find((p) => p.role === "department_head");
  const employee = profiles?.find((p) => p.role === "employee");

  console.log("Admin:", admin?.full_name);
  console.log("Asset Manager:", manager?.full_name);
  console.log("Dept Head:", deptHead?.full_name, "Dept:", deptHead?.department_id);
  console.log("Employee:", employee?.full_name);

  // Test 1: Notifications count for a user
  if (employee) {
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", employee.id)
      .eq("is_read", false);
    console.log(`Unread notifications for Employee ${employee.full_name}:`, count);
  }

  // Test 2: Log visibility scoping simulation
  // Fetch activity logs directly with role filters using equivalent rules from actions
  console.log("\n--- SIMULATING ROLE-BASED ACTIVITY LOG VISIBILITY ---");

  // Admin visibility (sees all)
  const { data: adminLogs } = await supabase.from("activity_logs").select("*").limit(5);
  console.log(`Admin sees ${adminLogs?.length} recent activity logs.`);

  // Employee visibility (only own actions)
  if (employee) {
    const { data: empLogs } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("actor_id", employee.id)
      .limit(5);
    console.log(`Employee (${employee.full_name}) sees ${empLogs?.length} own activity logs.`);
  }

  // Dept Head visibility (sees own department's activity)
  if (deptHead && deptHead.department_id) {
    const { data: deptAssets } = await supabase
      .from("assets")
      .select("id")
      .eq("department_id", deptHead.department_id);
    const { data: deptEmployees } = await supabase
      .from("profiles")
      .select("id")
      .eq("department_id", deptHead.department_id);

    const assetIds = deptAssets?.map((a) => a.id) || [];
    const employeeIds = deptEmployees?.map((e) => e.id) || [];

    const conditions: string[] = [];
    if (employeeIds.length > 0) conditions.push(`actor_id.in.(${employeeIds.map(id => `"${id}"`).join(",")})`);
    if (assetIds.length > 0) conditions.push(`and(entity_type.eq.asset,entity_id.in.(${assetIds.map(id => `"${id}"`).join(",")}))`);

    // Get allocations, bookings, maintenance related to these assets or employees
    const allocQueries = [];
    if (assetIds.length > 0) allocQueries.push(`asset_id.in.(${assetIds.map(id => `"${id}"`).join(",")})`);
    if (employeeIds.length > 0) allocQueries.push(`employee_id.in.(${employeeIds.map(id => `"${id}"`).join(",")})`);

    const { data: allocs } = allocQueries.length > 0
      ? await supabase.from("asset_allocations").select("id").or(allocQueries.join(","))
      : { data: [] };

    const bookingQueries = [];
    if (assetIds.length > 0) bookingQueries.push(`asset_id.in.(${assetIds.map(id => `"${id}"`).join(",")})`);
    if (employeeIds.length > 0) bookingQueries.push(`booked_by.in.(${employeeIds.map(id => `"${id}"`).join(",")})`);

    const { data: bookings } = bookingQueries.length > 0
      ? await supabase.from("bookings").select("id").or(bookingQueries.join(","))
      : { data: [] };

    const { data: maints } = assetIds.length > 0
      ? await supabase.from("maintenance_requests").select("id").in("asset_id", assetIds)
      : { data: [] };

    const allocIds = allocs?.map(a => a.id) || [];
    const bookingIds = bookings?.map(b => b.id) || [];
    const maintIds = maints?.map(m => m.id) || [];

    if (allocIds.length > 0) conditions.push(`and(entity_type.eq.allocation,entity_id.in.(${allocIds.map(id => `"${id}"`).join(",")}))`);
    if (bookingIds.length > 0) conditions.push(`and(entity_type.eq.booking,entity_id.in.(${bookingIds.map(id => `"${id}"`).join(",")}))`);
    if (maintIds.length > 0) conditions.push(`and(entity_type.eq.maintenance_request,entity_id.in.(${maintIds.map(id => `"${id}"`).join(",")}))`);

    const { data: headLogs } = conditions.length > 0
      ? await supabase.from("activity_logs").select("*").or(conditions.join(","))
      : { data: [] };

    console.log(`Dept Head (${deptHead.full_name}) sees ${headLogs?.length} department activity logs.`);
  }

  console.log("Verification finished successfully.");
}

run().catch(console.error);
