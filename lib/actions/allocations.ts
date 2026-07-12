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

interface RequestTransferPayload {
  assetId: string;
  toEmployeeId: string;
  reason?: string;
}

export async function requestTransfer(payload: RequestTransferPayload) {
  const supabase = await createClient();

  // Verify auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { assetId, toEmployeeId, reason } = payload;

  // 1. Get active allocation
  const { data: activeAlloc, error: allocErr } = await supabase
    .from("asset_allocations")
    .select("id, employee_id, asset:assets(name, asset_tag)")
    .eq("asset_id", assetId)
    .eq("status", "active")
    .maybeSingle();

  if (allocErr || !activeAlloc) {
    return { error: "Asset is not currently allocated." };
  }

  const fromEmployeeId = activeAlloc.employee_id;
  if (!fromEmployeeId) {
    return { error: "Asset is allocated to a department. Transfers only support employee targets." };
  }

  if (fromEmployeeId === toEmployeeId) {
    return { error: "Cannot transfer asset to the current holder." };
  }

  // 2. Insert transfer request
  const { data: newRequest, error: insertErr } = await supabase
    .from("transfer_requests")
    .insert({
      asset_id: assetId,
      from_employee_id: fromEmployeeId,
      to_employee_id: toEmployeeId,
      requested_by: user.id,
      reason: reason || null,
      status: "requested",
    })
    .select()
    .single();

  if (insertErr) {
    return { error: insertErr.message };
  }

  // 3. Write activity log
  await supabase.from("activity_logs").insert({
    actor_id: user.id,
    action: "transfer.requested",
    entity_type: "asset",
    entity_id: assetId,
    details: {
      name: (activeAlloc.asset as any).name,
      asset_tag: (activeAlloc.asset as any).asset_tag,
      from_employee_id: fromEmployeeId,
      to_employee_id: toEmployeeId,
    },
  });

  // 4. Send notification to approvers
  const recipients = new Set<string>();

  // Fetch the current holder's department head
  const { data: holderProfile } = await supabase
    .from("profiles")
    .select("department_id")
    .eq("id", fromEmployeeId)
    .single();

  if (holderProfile?.department_id) {
    const { data: dept } = await supabase
      .from("departments")
      .select("head_id")
      .eq("id", holderProfile.department_id)
      .single();

    if (dept?.head_id) {
      recipients.add(dept.head_id);
    }
  }

  // Fetch all managers/admins
  const { data: managers } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["asset_manager", "admin"]);

  if (managers) {
    managers.forEach((m) => recipients.add(m.id));
  }

  // Send notification to everyone in audience
  const notificationsPayload = Array.from(recipients).map((rId) => ({
    user_id: rId,
    title: "Asset Transfer Requested",
    message: `A transfer request has been raised for asset "${(activeAlloc.asset as any).name}" (${(activeAlloc.asset as any).asset_tag}).`,
    type: "transfer_requested",
    related_type: "transfer_request",
    related_id: newRequest.id,
  }));

  if (notificationsPayload.length > 0) {
    await supabase.from("notifications").insert(notificationsPayload);
  }

  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/allocations");

  return { success: true };
}

interface ApproveTransferPayload {
  transferRequestId: string;
}

export async function approveTransfer(payload: ApproveTransferPayload) {
  const supabase = await createClient();

  // Verify auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { transferRequestId } = payload;

  // Retrieve transfer request details
  const { data: req, error: reqErr } = await supabase
    .from("transfer_requests")
    .select(`
      *,
      asset:assets(id, name, asset_tag)
    `)
    .eq("id", transferRequestId)
    .single();

  if (reqErr || !req) {
    return { error: "Transfer request not found" };
  }

  if (req.status !== "requested") {
    return { error: `Request status is currently '${req.status}' and cannot be approved.` };
  }

  // Verify permission
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role, department_id")
    .eq("id", user.id)
    .single();

  if (!callerProfile) {
    return { error: "Profile not found" };
  }

  let authorized = false;
  if (callerProfile.role === "admin" || callerProfile.role === "asset_manager") {
    authorized = true;
  } else if (callerProfile.role === "department_head") {
    // Current holder's profile
    const { data: holderProfile } = await supabase
      .from("profiles")
      .select("department_id")
      .eq("id", req.from_employee_id)
      .single();

    if (holderProfile && holderProfile.department_id === callerProfile.department_id) {
      authorized = true;
    }
  }

  if (!authorized) {
    return { error: "Unauthorized: You do not have permission to approve this transfer." };
  }

  // 1. Close current allocation
  const { error: closeAllocErr } = await supabase
    .from("asset_allocations")
    .update({
      status: "returned",
      returned_at: new Date().toISOString(),
      return_reason: "transferred",
      return_condition_notes: "Asset transferred to new employee.",
    })
    .eq("asset_id", req.asset_id)
    .eq("status", "active");

  if (closeAllocErr) {
    return { error: closeAllocErr.message };
  }

  // 2. Open new allocation
  const { error: newAllocErr } = await supabase
    .from("asset_allocations")
    .insert({
      asset_id: req.asset_id,
      employee_id: req.to_employee_id,
      allocated_by: user.id,
      status: "active",
    });

  if (newAllocErr) {
    return { error: newAllocErr.message };
  }

  // 3. Update transfer request status
  const { error: updateReqErr } = await supabase
    .from("transfer_requests")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", transferRequestId);

  if (updateReqErr) {
    return { error: updateReqErr.message };
  }

  // 4. Force ensure asset remains marked as 'allocated'
  await supabase
    .from("assets")
    .update({ status: "allocated" })
    .eq("id", req.asset_id);

  // 5. Write activity log
  await supabase.from("activity_logs").insert({
    actor_id: user.id,
    action: "transfer.approved",
    entity_type: "asset",
    entity_id: req.asset_id,
    details: {
      name: (req.asset as any).name,
      asset_tag: (req.asset as any).asset_tag,
      from_employee_id: req.from_employee_id,
      to_employee_id: req.to_employee_id,
      transfer_id: req.id,
    },
  });

  // 6. Notify both old and new holder
  const notifyList = [
    {
      user_id: req.from_employee_id,
      title: "Asset Transferred Out",
      message: `Asset "${(req.asset as any).name}" has been transferred out to a new holder.`,
      type: "transfer_approved",
      related_type: "asset",
      related_id: req.asset_id,
    },
    {
      user_id: req.to_employee_id,
      title: "Asset Transferred In",
      message: `Asset "${(req.asset as any).name}" has been transferred and allocated to you.`,
      type: "transfer_approved",
      related_type: "asset",
      related_id: req.asset_id,
    },
  ];

  await supabase.from("notifications").insert(notifyList);

  revalidatePath("/assets");
  revalidatePath(`/assets/${req.asset_id}`);
  revalidatePath("/allocations");

  return { success: true };
}

interface RejectTransferPayload {
  transferRequestId: string;
  reason: string;
}

export async function rejectTransfer(payload: RejectTransferPayload) {
  const supabase = await createClient();

  // Verify auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { transferRequestId, reason } = payload;

  if (!reason.trim()) {
    return { error: "Rejection reason is required." };
  }

  // Retrieve transfer request details
  const { data: req, error: reqErr } = await supabase
    .from("transfer_requests")
    .select(`
      *,
      asset:assets(id, name, asset_tag)
    `)
    .eq("id", transferRequestId)
    .single();

  if (reqErr || !req) {
    return { error: "Transfer request not found" };
  }

  if (req.status !== "requested") {
    return { error: `Request status is currently '${req.status}' and cannot be rejected.` };
  }

  // Verify permission
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role, department_id")
    .eq("id", user.id)
    .single();

  if (!callerProfile) {
    return { error: "Profile not found" };
  }

  let authorized = false;
  if (callerProfile.role === "admin" || callerProfile.role === "asset_manager") {
    authorized = true;
  } else if (callerProfile.role === "department_head") {
    // Current holder's profile
    const { data: holderProfile } = await supabase
      .from("profiles")
      .select("department_id")
      .eq("id", req.from_employee_id)
      .single();

    if (holderProfile && holderProfile.department_id === callerProfile.department_id) {
      authorized = true;
    }
  }

  if (!authorized) {
    return { error: "Unauthorized: You do not have permission to reject this transfer." };
  }

  // 1. Update status to 'rejected'
  const { error: updateReqErr } = await supabase
    .from("transfer_requests")
    .update({
      status: "rejected",
      rejection_reason: reason,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", transferRequestId);

  if (updateReqErr) {
    return { error: updateReqErr.message };
  }

  // 2. Notify requester
  await supabase.from("notifications").insert({
    user_id: req.requested_by,
    title: "Transfer Request Rejected",
    message: `Your transfer request for asset "${(req.asset as any).name}" was rejected. Reason: ${reason}`,
    type: "transfer_rejected",
    related_type: "asset",
    related_id: req.asset_id,
  });

  revalidatePath("/assets");
  revalidatePath(`/assets/${req.asset_id}`);
  revalidatePath("/allocations");

  return { success: true };
}

export async function getTransferRequests() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transfer_requests")
    .select(`
      *,
      asset:assets(id, name, asset_tag),
      from_employee:profiles!transfer_requests_from_employee_id_fkey(full_name, email, department_id),
      to_employee:profiles!transfer_requests_to_employee_id_fkey(full_name, email),
      requester:profiles!transfer_requests_requested_by_fkey(full_name)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  return { data };
}

export async function getReturnHistory() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("asset_allocations")
    .select(`
      *,
      asset:assets(id, name, asset_tag),
      employee:profiles!asset_allocations_employee_id_fkey(full_name),
      department:departments!asset_allocations_department_id_fkey(name),
      allocator:profiles!asset_allocations_allocated_by_fkey(full_name)
    `)
    .eq("status", "returned")
    .order("returned_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  return { data };
}

