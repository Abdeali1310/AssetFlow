"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface AllocatePayload {
  assetId: string;
  employeeId?: string | null;
  departmentId?: string | null;
  expectedReturnDate?: string | null;
}

export async function allocateAsset(payload: AllocatePayload) {
  const supabase = await createClient();

  // Verify auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: { message: "Unauthorized" } };
  }

  const { assetId, employeeId, departmentId, expectedReturnDate } = payload;

  if (!employeeId && !departmentId) {
    return { error: { message: "Must allocate to an employee or a department." } };
  }

  // 1. Lock-read the asset's current status
  const { data: asset, error: assetErr } = await supabase
    .from("assets")
    .select("id, status, name, asset_tag")
    .eq("id", assetId)
    .single();

  if (assetErr || !asset) {
    return { error: { message: "Asset not found" } };
  }

  // 2. Check if already allocated or not available
  if (asset.status === "allocated") {
    // Retrieve details of the current active allocation
    const { data: activeAlloc } = await supabase
      .from("asset_allocations")
      .select(`
        id,
        employee:profiles!asset_allocations_employee_id_fkey(full_name),
        department:departments!asset_allocations_department_id_fkey(name)
      `)
      .eq("asset_id", assetId)
      .eq("status", "active")
      .maybeSingle();

    let heldByName = "an employee";
    let allocationId = "";

    if (activeAlloc) {
      allocationId = activeAlloc.id;
      if (activeAlloc.employee) {
        heldByName = (activeAlloc.employee as any).full_name;
      } else if (activeAlloc.department) {
        heldByName = `Department: ${(activeAlloc.department as any).name}`;
      }
    }

    return {
      error: {
        code: "ALREADY_ALLOCATED",
        message: `This asset is currently held by ${heldByName}.`,
        meta: {
          heldByName,
          allocationId,
        },
      },
    };
  }

  if (asset.status !== "available") {
    return {
      error: {
        message: `Asset status is '${asset.status}' and cannot be allocated.`,
      },
    };
  }

  // 3. Insert the allocation row
  const { data: newAlloc, error: allocErr } = await supabase
    .from("asset_allocations")
    .insert({
      asset_id: assetId,
      employee_id: employeeId || null,
      department_id: departmentId || null,
      expected_return_date: expectedReturnDate || null,
      allocated_by: user.id,
      status: "active",
    })
    .select()
    .single();

  if (allocErr) {
    return { error: { message: allocErr.message } };
  }

  // 4. Update asset status to 'allocated'
  const { error: updateErr } = await supabase
    .from("assets")
    .update({ status: "allocated" })
    .eq("id", assetId);

  if (updateErr) {
    return { error: { message: updateErr.message } };
  }

  // 5. Write activity log
  await supabase.from("activity_logs").insert({
    actor_id: user.id,
    action: "asset.allocated",
    entity_type: "asset",
    entity_id: assetId,
    details: {
      name: asset.name,
      asset_tag: asset.asset_tag,
      target_type: employeeId ? "employee" : "department",
      target_id: employeeId || departmentId,
    },
  });

  // 6. Notify the recipient (or department head)
  let recipientId = employeeId;
  if (!recipientId && departmentId) {
    const { data: dept } = await supabase
      .from("departments")
      .select("head_id")
      .eq("id", departmentId)
      .single();
    recipientId = dept?.head_id || null;
  }

  if (recipientId) {
    await supabase.from("notifications").insert({
      user_id: recipientId,
      title: "Asset Allocated",
      message: `Asset "${asset.name}" (${asset.asset_tag}) has been assigned to you.`,
      type: "asset_assigned",
      related_type: "asset",
      related_id: assetId,
    });
  }

  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/allocations");

  return { success: true, data: newAlloc };
}

interface ReturnPayload {
  allocationId: string;
  conditionNotes: string;
}

export async function returnAllocation(payload: ReturnPayload) {
  const supabase = await createClient();

  // Verify auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { allocationId, conditionNotes } = payload;

  // 1. Retrieve active allocation
  const { data: alloc, error: allocErr } = await supabase
    .from("asset_allocations")
    .select(`
      *,
      asset:assets(id, name, asset_tag)
    `)
    .eq("id", allocationId)
    .single();

  if (allocErr || !alloc) {
    return { error: "Allocation record not found" };
  }

  // 2. Update asset_allocations to closed status
  const { error: updateAllocErr } = await supabase
    .from("asset_allocations")
    .update({
      status: "returned",
      returned_at: new Date().toISOString(),
      return_condition_notes: conditionNotes,
      return_reason: "returned",
    })
    .eq("id", allocationId);

  if (updateAllocErr) {
    return { error: updateAllocErr.message };
  }

  // 3. Defensive check: is there a transfer request in-flight?
  const { data: transferInFlight } = await supabase
    .from("transfer_requests")
    .select("id")
    .eq("asset_id", alloc.asset_id)
    .eq("status", "requested")
    .limit(1)
    .maybeSingle();

  // Only flip to available if no transfer is in flight
  if (!transferInFlight) {
    const { error: updateAssetErr } = await supabase
      .from("assets")
      .update({ status: "available" })
      .eq("id", alloc.asset_id);

    if (updateAssetErr) {
      return { error: updateAssetErr.message };
    }
  }

  // 4. Write activity log
  await supabase.from("activity_logs").insert({
    actor_id: user.id,
    action: "asset.returned",
    entity_type: "asset",
    entity_id: alloc.asset_id,
    details: {
      name: alloc.asset.name,
      asset_tag: alloc.asset.asset_tag,
      returned_by: user.id,
    },
  });

  // 5. Write notification to the original recipient that it was processed
  const notifyUser = alloc.employee_id || user.id;
  await supabase.from("notifications").insert({
    user_id: notifyUser,
    title: "Asset Returned",
    message: `Return processed for asset "${alloc.asset.name}" (${alloc.asset.asset_tag}).`,
    type: "allocation_returned",
    related_type: "asset",
    related_id: alloc.asset_id,
  });

  revalidatePath("/assets");
  revalidatePath(`/assets/${alloc.asset_id}`);
  revalidatePath("/allocations");

  return { success: true };
}

export async function getActiveAllocations() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("asset_allocations")
    .select(`
      *,
      asset:assets(
        *,
        category:asset_categories(name)
      ),
      employee:profiles!asset_allocations_employee_id_fkey(full_name, email),
      department:departments!asset_allocations_department_id_fkey(name),
      allocator:profiles!asset_allocations_allocated_by_fkey(full_name)
    `)
    .eq("status", "active")
    .order("allocated_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  return { data };
}

export async function getAllocationHistory(assetId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("asset_allocations")
    .select(`
      *,
      employee:profiles!asset_allocations_employee_id_fkey(full_name),
      department:departments!asset_allocations_department_id_fkey(name),
      allocator:profiles!asset_allocations_allocated_by_fkey(full_name)
    `)
    .eq("asset_id", assetId)
    .order("allocated_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  return { data };
}
