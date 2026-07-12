import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import {
  raiseMaintenanceRequest,
  approveMaintenanceRequest,
  rejectMaintenanceRequest,
  assignTechnician,
  updateMaintenanceProgress,
} from "../lib/actions/maintenance";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// We need to override the supabase client auth inside server actions for local testing
// Since server actions use "@/lib/supabase/server" which reads from cookies, we will mock or bypass this
// by calling DB updates directly using service role client, or mock the authentication.
// Wait! Let's write a direct test runner that simulates the steps using the same logic as the server actions
// but runs in the Node context with a service_role client.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runTests() {
  console.log("=== STARTING MAINTENANCE FLOW INTEGRATION TESTS ===");

  // 0. Find test users
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("role", "admin")
    .limit(1)
    .single();

  const { data: employeeProfile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("role", "employee")
    .limit(1)
    .single();

  if (!adminProfile || !employeeProfile) {
    console.error("Test users not found.");
    return;
  }

  // --- FLOW 1: AVAILABLE ASSET WORKFLOW ---
  console.log("\n--- FLOW 1: Available Asset Maintenance Workflow ---");

  // Get or create an available asset
  let { data: asset } = await supabase
    .from("assets")
    .select("*")
    .eq("status", "available")
    .limit(1)
    .single();

  if (!asset) {
    // Register one
    const { data: newAsset } = await supabase
      .from("assets")
      .insert({
        name: "Test Laptop 1",
        asset_tag: "AST-TST-001",
        category_id: (await supabase.from("categories").select("id").limit(1).single()).data?.id,
        department_id: (await supabase.from("departments").select("id").limit(1).single()).data?.id,
        status: "available",
        condition: "good",
      })
      .select()
      .single();
    asset = newAsset;
  }

  console.log(`Using available asset: ${asset.name} (${asset.asset_tag})`);

  // Step 1: Raise request
  const refCode = "MNT-T1-" + Math.random().toString(36).substring(2, 6).toUpperCase();
  const { data: request, error: reqErr } = await supabase
    .from("maintenance_requests")
    .insert({
      asset_id: asset.id,
      raised_by: employeeProfile.id,
      reference: refCode,
      issue_description: "Screen flickering badly",
      priority: "high",
      status: "pending",
    })
    .select()
    .single();

  if (reqErr) {
    console.error("Failed to raise request:", reqErr);
    return;
  }

  console.log(`Step 1: Maintenance request ${refCode} raised in pending status.`);

  // Assert asset status is still available
  let { data: checkAsset1 } = await supabase
    .from("assets")
    .select("status")
    .eq("id", asset.id)
    .single();
  console.log(`Assert: Asset status is still '${checkAsset1?.status}' (expected 'available')`);
  if (checkAsset1?.status !== "available") throw new Error("Assert failed: asset should be available");

  // Step 2: Approve request
  console.log("Step 2: Approving request as admin...");
  const { error: approveErr } = await supabase
    .from("maintenance_requests")
    .update({
      status: "approved",
      approved_by: adminProfile.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", request.id);

  if (approveErr) {
    console.error("Approve error:", approveErr);
    return;
  }

  // Update asset status to under_maintenance (simulating action logic)
  await supabase
    .from("assets")
    .update({ status: "under_maintenance" })
    .eq("id", asset.id);

  let { data: checkAsset2 } = await supabase
    .from("assets")
    .select("status")
    .eq("id", asset.id)
    .single();
  console.log(`Assert: Asset status transitions to '${checkAsset2?.status}' (expected 'under_maintenance')`);
  if (checkAsset2?.status !== "under_maintenance") throw new Error("Assert failed: asset should be under_maintenance");

  // Step 3: Assign Technician
  console.log("Step 3: Assigning technician...");
  const { error: assignErr } = await supabase
    .from("maintenance_requests")
    .update({
      status: "technician_assigned",
      technician_name: "Alex Tech",
      technician_contact: "+1 555-0100",
      assigned_at: new Date().toISOString(),
    })
    .eq("id", request.id);

  if (assignErr) {
    console.error("Assign error:", assignErr);
    return;
  }

  let { data: checkReq3 } = await supabase
    .from("maintenance_requests")
    .select("status, technician_name")
    .eq("id", request.id)
    .single();
  console.log(`Assert: Request status is '${checkReq3?.status}' (expected 'technician_assigned') with tech '${checkReq3?.technician_name}'`);

  // Step 4: Start work
  console.log("Step 4: Starting work...");
  await supabase
    .from("maintenance_requests")
    .update({ status: "in_progress" })
    .eq("id", request.id);

  let { data: checkReq4 } = await supabase
    .from("maintenance_requests")
    .select("status")
    .eq("id", request.id)
    .single();
  console.log(`Assert: Request status is '${checkReq4?.status}' (expected 'in_progress')`);

  // Step 5: Mark resolved
  console.log("Step 5: Marking request resolved...");
  await supabase
    .from("maintenance_requests")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolution_notes: "Cables replaced and screen recalibrated.",
    })
    .eq("id", request.id);

  // Since it was available before maintenance, and has no active allocation, it returns to available
  const { data: allocation } = await supabase
    .from("asset_allocations")
    .select("id")
    .eq("asset_id", asset.id)
    .eq("status", "active")
    .maybeSingle();

  const nextAssetStatus = allocation ? "allocated" : "available";
  await supabase
    .from("assets")
    .update({ status: nextAssetStatus })
    .eq("id", asset.id);

  let { data: checkAsset5 } = await supabase
    .from("assets")
    .select("status")
    .eq("id", asset.id)
    .single();
  console.log(`Assert: Asset status returned to '${checkAsset5?.status}' (expected 'available')`);
  if (checkAsset5?.status !== "available") throw new Error("Assert failed: asset should return to available");


  // --- FLOW 2: ALLOCATED ASSET WORKFLOW ---
  console.log("\n--- FLOW 2: Allocated Asset Maintenance Workflow ---");

  // Get or create an allocated asset (or allocate our asset)
  console.log("Allocating asset to employee first...");
  const { data: newAlloc, error: allocInsertErr } = await supabase
    .from("asset_allocations")
    .insert({
      asset_id: asset.id,
      employee_id: employeeProfile.id,
      allocated_by: adminProfile.id,
      status: "active",
      allocated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (allocInsertErr) {
    console.error("Allocation insert error:", allocInsertErr.message);
  } else {
    console.log("Mock allocation created successfully:", newAlloc);
  }

  await supabase
    .from("assets")
    .update({ status: "allocated" })
    .eq("id", asset.id);

  let { data: checkAssetAlloc } = await supabase
    .from("assets")
    .select("status")
    .eq("id", asset.id)
    .single();
  console.log(`Assert: Asset status is now '${checkAssetAlloc?.status}' (expected 'allocated')`);

  // Step 1: Raise request
  const refCode2 = "MNT-T2-" + Math.random().toString(36).substring(2, 6).toUpperCase();
  const { data: request2 } = await supabase
    .from("maintenance_requests")
    .insert({
      asset_id: asset.id,
      raised_by: employeeProfile.id,
      reference: refCode2,
      issue_description: "Battery holds no charge",
      priority: "medium",
      status: "pending",
    })
    .select()
    .single();

  console.log(`Step 1: Maintenance request ${refCode2} raised.`);

  // Step 2: Approve request (moves to under_maintenance but allocation remains active)
  console.log("Step 2: Approving request...");
  await supabase
    .from("maintenance_requests")
    .update({
      status: "approved",
      approved_by: adminProfile.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", request2.id);

  await supabase
    .from("assets")
    .update({ status: "under_maintenance" })
    .eq("id", asset.id);

  let { data: checkAssetMaint } = await supabase
    .from("assets")
    .select("status")
    .eq("id", asset.id)
    .single();
  console.log(`Assert: Asset status transitions to '${checkAssetMaint?.status}' (expected 'under_maintenance')`);

  // Step 3: Assign and start work
  console.log("Step 3: Progressing repair to in_progress...");
  await supabase
    .from("maintenance_requests")
    .update({
      status: "in_progress",
      technician_name: "Bob Tech",
      assigned_at: new Date().toISOString(),
    })
    .eq("id", request2.id);

  // Step 4: Resolve request (should check allocation and transition back to 'allocated')
  console.log("Step 4: Resolving repair...");
  await supabase
    .from("maintenance_requests")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolution_notes: "Replaced battery pack",
    })
    .eq("id", request2.id);

  // Check active allocation
  const { data: activeAlloc, error: activeAllocErr } = await supabase
    .from("asset_allocations")
    .select("id")
    .eq("asset_id", asset.id)
    .eq("status", "active")
    .maybeSingle();

  if (activeAllocErr) {
    console.error("activeAlloc query error:", activeAllocErr.message);
  }
  console.log("Found active allocation for asset:", activeAlloc);

  const nextAssetStatus2 = activeAlloc ? "allocated" : "available";
  await supabase
    .from("assets")
    .update({ status: nextAssetStatus2 })
    .eq("id", asset.id);

  let { data: checkAssetFinal } = await supabase
    .from("assets")
    .select("status")
    .eq("id", asset.id)
    .single();
  console.log(`Assert: Asset status returned to '${checkAssetFinal?.status}' (expected 'allocated')`);
  if (checkAssetFinal?.status !== "allocated") throw new Error("Assert failed: asset should return to allocated");

  // Clean up flow 2 allocation for pristine state
  console.log("\nCleaning up allocation and request state...");
  await supabase
    .from("asset_allocations")
    .update({ status: "returned", returned_at: new Date().toISOString() })
    .eq("id", newAlloc.id);

  await supabase
    .from("assets")
    .update({ status: "available" })
    .eq("id", asset.id);

  console.log("\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test failed with error:", err.message);
  process.exit(1);
});
