"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface GetRequestsFilters {
  status?: string;
  assetId?: string;
  priority?: string;
}

export async function getMaintenanceRequests(filters?: GetRequestsFilters) {
  const supabase = await createClient();

  let query = supabase
    .from("maintenance_requests")
    .select(`
      *,
      asset:assets(id, name, asset_tag, status),
      reporter:profiles!maintenance_requests_raised_by_fkey(id, full_name, email)
    `);

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters?.assetId) {
    query = query.eq("asset_id", filters.assetId);
  }

  if (filters?.priority && filters.priority !== "all") {
    query = query.eq("priority", filters.priority);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  return { data };
}

export async function getMaintenanceRequestById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("maintenance_requests")
    .select(`
      *,
      asset:assets(id, name, asset_tag, status, serial_number, location, acquisition_cost),
      reporter:profiles!maintenance_requests_raised_by_fkey(id, full_name, email),
      approver:profiles!maintenance_requests_approved_by_fkey(id, full_name, email)
    `)
    .eq("id", id)
    .single();

  if (error) {
    return { error: error.message };
  }

  return { data };
}

export async function uploadMaintenancePhotoAction(base64Data: string, fileName: string, mimeType: string) {
  const { createClient: createSupabaseJSClient } = await import("@supabase/supabase-js");
  const supabase = createSupabaseJSClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const fileBuffer = Buffer.from(base64Data, "base64");
  const fileExt = fileName.split(".").pop();
  const uniqueName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
  const filePath = `maintenance-photos/${uniqueName}`;

  const { data, error } = await supabase.storage
    .from("maintenance-photos")
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    return { error: error.message };
  }

  const { data: { publicUrl } } = supabase.storage
    .from("maintenance-photos")
    .getPublicUrl(filePath);

  return { success: true, publicUrl };
}

interface RaiseRequestPayload {
  assetId: string;
  issueDescription: string;
  priority: "low" | "medium" | "high" | "critical";
  photoUrl?: string;
}

export async function raiseMaintenanceRequest(payload: RaiseRequestPayload) {
  const supabase = await createClient();

  // 1. Verify user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { assetId, issueDescription, priority, photoUrl } = payload;

  if (!issueDescription.trim()) {
    return { error: "Issue description is required." };
  }

  // 2. Retrieve asset details for notifications/activity logs
  const { data: asset, error: assetErr } = await supabase
    .from("assets")
    .select("id, name, asset_tag")
    .eq("id", assetId)
    .single();

  if (assetErr || !asset) {
    return { error: "Asset not found." };
  }

  // 3. Generate unique Maintenance reference code
  const refCode = "MNT-" + Math.random().toString(36).substring(2, 8).toUpperCase();

  // 4. Insert maintenance request (status starts as 'pending')
  const { data: newRequest, error: insertErr } = await supabase
    .from("maintenance_requests")
    .insert({
      asset_id: assetId,
      raised_by: user.id,
      reference: refCode,
      issue_description: issueDescription,
      priority,
      photo_url: photoUrl || null,
      status: "pending",
    })
    .select()
    .single();

  if (insertErr) {
    return { error: insertErr.message };
  }

  // 5. Write activity log
  await supabase.from("activity_logs").insert({
    actor_id: user.id,
    action: "maintenance.raised",
    entity_type: "asset",
    entity_id: assetId,
    details: {
      reference: refCode,
      name: asset.name,
      asset_tag: asset.asset_tag,
      priority,
    },
  });

  // 6. Notify all Managers and Admins (asset_manager pool)
  const { data: managers } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["asset_manager", "admin"]);

  if (managers && managers.length > 0) {
    const notificationPayload = managers.map((m) => ({
      user_id: m.id,
      title: "New Maintenance Request",
      message: `A new maintenance request (${refCode}) has been raised for asset "${asset.name}" (${asset.asset_tag}).`,
      type: "maintenance_raised",
      related_type: "maintenance",
      related_id: newRequest.id,
    }));

    await supabase.from("notifications").insert(notificationPayload);
  }

  revalidatePath("/maintenance");
  revalidatePath(`/assets/${assetId}`);

  return { success: true, data: newRequest };
}

// ==========================================
// PHASE 8 TASK 24 ACTIONS
// ==========================================

export async function approveMaintenanceRequest(requestId: string) {
  const supabase = await createClient();

  // 1. Verify user session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // 2. Verify role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "asset_manager")) {
    return { error: "Permission denied: only managers/admins can approve requests" };
  }

  // 3. Get request details
  const { data: request, error: reqErr } = await supabase
    .from("maintenance_requests")
    .select("*, asset:assets(id, name, asset_tag, status)")
    .eq("id", requestId)
    .single();

  if (reqErr || !request) {
    return { error: "Maintenance request not found." };
  }

  if (request.status !== "pending") {
    return { error: "Request is not in pending status." };
  }

  // 4. Update request status to approved
  const { error: updateErr } = await supabase
    .from("maintenance_requests")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (updateErr) {
    return { error: updateErr.message };
  }

  // 5. Update asset status to 'under_maintenance'
  const oldStatus = request.asset.status;
  const { error: assetUpdateErr } = await supabase
    .from("assets")
    .update({ status: "under_maintenance" })
    .eq("id", request.asset_id);

  if (assetUpdateErr) {
    return { error: assetUpdateErr.message };
  }

  // 6. Log status transition
  await supabase.from("activity_logs").insert({
    actor_id: user.id,
    action: "asset.status_transition",
    entity_type: "asset",
    entity_id: request.asset_id,
    details: {
      from: oldStatus,
      to: "under_maintenance",
      reason: "maintenance_approved",
      reference: request.reference,
    },
  });

  // 7. Notify requester
  await supabase.from("notifications").insert({
    user_id: request.raised_by,
    title: "Maintenance Request Approved",
    message: `Your maintenance request (${request.reference}) has been approved and the asset is now under maintenance.`,
    type: "maintenance_approved",
    related_type: "maintenance",
    related_id: requestId,
  });

  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${requestId}`);
  revalidatePath(`/assets/${request.asset_id}`);

  return { success: true };
}

export async function rejectMaintenanceRequest(requestId: string, reason: string) {
  const supabase = await createClient();

  if (!reason.trim()) {
    return { error: "Rejection reason is required." };
  }

  // 1. Verify user session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // 2. Verify role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "asset_manager")) {
    return { error: "Permission denied: only managers/admins can reject requests" };
  }

  // 3. Get request details
  const { data: request, error: reqErr } = await supabase
    .from("maintenance_requests")
    .select("*, asset:assets(id, name, asset_tag)")
    .eq("id", requestId)
    .single();

  if (reqErr || !request) {
    return { error: "Maintenance request not found." };
  }

  if (request.status !== "pending") {
    return { error: "Request is not in pending status." };
  }

  // 4. Update request status to rejected
  const { error: updateErr } = await supabase
    .from("maintenance_requests")
    .update({
      status: "rejected",
      rejection_reason: reason,
    })
    .eq("id", requestId);

  if (updateErr) {
    return { error: updateErr.message };
  }

  // 5. Notify requester
  await supabase.from("notifications").insert({
    user_id: request.raised_by,
    title: "Maintenance Request Rejected",
    message: `Your maintenance request (${request.reference}) was rejected. Reason: "${reason}"`,
    type: "maintenance_rejected",
    related_type: "maintenance",
    related_id: requestId,
  });

  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${requestId}`);

  return { success: true };
}

interface AssignTechnicianPayload {
  requestId: string;
  technicianName: string;
  technicianContact?: string;
}

export async function assignTechnician(payload: AssignTechnicianPayload) {
  const supabase = await createClient();
  const { requestId, technicianName, technicianContact } = payload;

  if (!technicianName.trim()) {
    return { error: "Technician name is required." };
  }

  // 1. Verify user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // 2. Verify role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "asset_manager")) {
    return { error: "Permission denied." };
  }

  // 3. Get request details
  const { data: request, error: reqErr } = await supabase
    .from("maintenance_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (reqErr || !request) {
    return { error: "Request not found." };
  }

  if (request.status !== "approved") {
    return { error: "Technician can only be assigned to approved requests." };
  }

  // 4. Update status to technician_assigned
  const { error: updateErr } = await supabase
    .from("maintenance_requests")
    .update({
      status: "technician_assigned",
      technician_name: technicianName,
      technician_contact: technicianContact || null,
      assigned_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (updateErr) {
    return { error: updateErr.message };
  }

  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${requestId}`);

  return { success: true };
}

interface UpdateProgressPayload {
  requestId: string;
  status: "in_progress" | "resolved";
  resolutionNotes?: string;
}

export async function updateMaintenanceProgress(payload: UpdateProgressPayload) {
  const supabase = await createClient();
  const { requestId, status, resolutionNotes } = payload;

  // 1. Verify user session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // 2. Verify role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "asset_manager")) {
    return { error: "Permission denied." };
  }

  // 3. Get request details
  const { data: request, error: reqErr } = await supabase
    .from("maintenance_requests")
    .select("*, asset:assets(id, name, asset_tag, status)")
    .eq("id", requestId)
    .single();

  if (reqErr || !request) {
    return { error: "Request not found." };
  }

  if (status === "in_progress") {
    if (request.status !== "technician_assigned") {
      return { error: "Work can only start after technician assignment." };
    }

    const { error: updateErr } = await supabase
      .from("maintenance_requests")
      .update({
        status: "in_progress",
      })
      .eq("id", requestId);

    if (updateErr) return { error: updateErr.message };

  } else if (status === "resolved") {
    if (request.status !== "in_progress") {
      return { error: "Request must be in progress to resolve." };
    }

    if (!resolutionNotes || !resolutionNotes.trim()) {
      return { error: "Resolution notes are required to resolve the issue." };
    }

    // Determine the next status for the asset:
    // Check if there is an active allocation for the asset
    const { data: allocation } = await supabase
      .from("asset_allocations")
      .select("id")
      .eq("asset_id", request.asset_id)
      .eq("status", "active")
      .maybeSingle();

    const nextAssetStatus = allocation ? "allocated" : "available";

    // Update maintenance request
    const { error: updateErr } = await supabase
      .from("maintenance_requests")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolution_notes: resolutionNotes,
      })
      .eq("id", requestId);

    if (updateErr) return { error: updateErr.message };

    // Update asset status
    const { error: assetUpdateErr } = await supabase
      .from("assets")
      .update({ status: nextAssetStatus })
      .eq("id", request.asset_id);

    if (assetUpdateErr) return { error: assetUpdateErr.message };

    // Log status transition
    await supabase.from("activity_logs").insert({
      actor_id: user.id,
      action: "asset.status_transition",
      entity_type: "asset",
      entity_id: request.asset_id,
      details: {
        from: "under_maintenance",
        to: nextAssetStatus,
        reason: "maintenance_resolved",
        reference: request.reference,
      },
    });

    // Notify requester
    await supabase.from("notifications").insert({
      user_id: request.raised_by,
      title: "Maintenance Completed",
      message: `Your maintenance request (${request.reference}) has been marked as resolved. Notes: "${resolutionNotes}"`,
      type: "maintenance_resolved",
      related_type: "maintenance",
      related_id: requestId,
    });
  }

  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${requestId}`);
  revalidatePath(`/assets/${request.asset_id}`);

  return { success: true };
}
