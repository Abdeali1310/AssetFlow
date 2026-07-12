"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateReference } from "@/lib/utils";
import type { Asset } from "@/lib/types";

export interface AssetFilters {
  search?: string;
  categoryId?: string;
  status?: string;
  departmentId?: string;
  location?: string;
  isBookable?: boolean;
}

export async function getAssets(filters?: AssetFilters) {
  const supabase = await createClient();

  let query = supabase
    .from("assets")
    .select(`
      *,
      category:asset_categories(name),
      department:departments(name),
      allocations:asset_allocations(
        id,
        status,
        employee:profiles!asset_allocations_employee_id_fkey(full_name),
        department:departments!asset_allocations_department_id_fkey(name)
      )
    `);

  if (filters) {
    if (filters.search) {
      // Postgres ILIKE search on asset_tag, serial_number, or name
      query = query.or(
        `asset_tag.ilike.%${filters.search}%,serial_number.ilike.%${filters.search}%,name.ilike.%${filters.search}%`
      );
    }
    if (filters.categoryId) {
      query = query.eq("category_id", filters.categoryId);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.departmentId) {
      query = query.eq("department_id", filters.departmentId);
    }
    if (filters.location) {
      query = query.ilike("location", `%${filters.location}%`);
    }
    if (typeof filters.isBookable === "boolean") {
      query = query.eq("is_bookable", filters.isBookable);
    }
  }

  // Newest assets first
  const { data: assets, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch assets: ${error.message}`);
  }

  // Format the returned data to match Asset interface with joined fields
  return (assets ?? []).map((asset: any) => {
    const category_name = asset.category?.name ?? null;
    const department_name = asset.department?.name ?? null;
    
    // Find the active allocation (should be at most one per uq index)
    const activeAllocation = asset.allocations?.find((a: any) => a.status === "active");
    
    let current_holder_name = null;
    let current_allocation_id = null;
    if (activeAllocation) {
      current_allocation_id = activeAllocation.id;
      if (activeAllocation.employee) {
        current_holder_name = activeAllocation.employee.full_name;
      } else if (activeAllocation.department) {
        current_holder_name = `Dept: ${activeAllocation.department.name}`;
      }
    }

    return {
      ...asset,
      category_name,
      department_name,
      current_holder_name,
      current_allocation_id,
    };
  }) as Asset[];
}

export async function getAssetById(id: string) {
  const supabase = await createClient();

  // Fetch asset details along with relations
  const { data: asset, error } = await supabase
    .from("assets")
    .select(`
      *,
      category:asset_categories(name),
      department:departments(name),
      allocations:asset_allocations(
        *,
        employee:profiles!asset_allocations_employee_id_fkey(full_name, department_id),
        department:departments!asset_allocations_department_id_fkey(name),
        allocator:profiles!asset_allocations_allocated_by_fkey(full_name)
      ),
      maintenance:maintenance_requests(
        *,
        raised_by_profile:profiles!maintenance_requests_raised_by_fkey(full_name),
        approved_by_profile:profiles!maintenance_requests_approved_by_fkey(full_name)
      ),
      transfer_requests:transfer_requests(
        *,
        requester:profiles!transfer_requests_requested_by_fkey(full_name),
        from_employee:profiles!transfer_requests_from_employee_id_fkey(full_name),
        to_employee:profiles!transfer_requests_to_employee_id_fkey(full_name),
        approved_by_profile:profiles!transfer_requests_approved_by_fkey(full_name)
      ),
      bookings:bookings(
        *,
        booker:profiles!bookings_booked_by_fkey(full_name)
      )
    `)
    .eq("id", id)
    .single();

  if (error) {
    return { error: error.message };
  }

  if (!asset) {
    return { error: "Asset not found" };
  }

  // Fetch activity logs separately due to generic entity relationship
  const { data: logs } = await supabase
    .from("activity_logs")
    .select(`
      *,
      actor:profiles!activity_logs_actor_id_fkey(full_name)
    `)
    .eq("entity_id", id)
    .eq("entity_type", "asset")
    .order("created_at", { ascending: false });

  // Format category and department names
  const category_name = asset.category?.name ?? null;
  const department_name = asset.department?.name ?? null;
  
  // Sort allocations and maintenance by date descending
  const sortedAllocations = (asset.allocations ?? []).sort(
    (a: any, b: any) => new Date(b.allocated_at).getTime() - new Date(a.allocated_at).getTime()
  );

  const sortedMaintenance = (asset.maintenance ?? []).sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const activeAllocation = sortedAllocations.find((a: any) => a.status === "active");
  let current_holder_name = null;
  let current_allocation_id = null;
  if (activeAllocation) {
    current_allocation_id = activeAllocation.id;
    if (activeAllocation.employee) {
      current_holder_name = activeAllocation.employee.full_name;
    } else if (activeAllocation.department) {
      current_holder_name = `Dept: ${activeAllocation.department.name}`;
    }
  }

  // Build chronologically merged timeline
  const timeline: {
    id: string;
    type: string;
    date: string;
    title: string;
    description: string;
    actor: string;
  }[] = [];

  // Add allocations to timeline
  (asset.allocations ?? []).forEach((alloc: any) => {
    const targetName = alloc.employee?.full_name || (alloc.department ? `Dept: ${alloc.department.name}` : "Unknown");
    const allocatorName = alloc.allocator?.full_name || "Manager";
    
    timeline.push({
      id: `alloc-start-${alloc.id}`,
      type: "allocation",
      date: alloc.allocated_at,
      title: "Asset Allocated",
      description: `Asset allocated to ${targetName} by ${allocatorName}.`,
      actor: allocatorName,
    });

    if (alloc.returned_at) {
      timeline.push({
        id: `alloc-end-${alloc.id}`,
        type: "allocation",
        date: alloc.returned_at,
        title: "Asset Returned",
        description: `Returned. Reason: ${alloc.return_reason || "None"}. Notes: ${alloc.return_condition_notes || "—"}`,
        actor: targetName,
      });
    }
  });

  // Add transfer requests to timeline
  (asset.transfer_requests ?? []).forEach((req: any) => {
    const fromName = req.from_employee?.full_name || "Current Holder";
    const toName = req.to_employee?.full_name || "Proposed Holder";
    const requesterName = req.requester?.full_name || "Requester";

    timeline.push({
      id: `transfer-req-${req.id}`,
      type: "transfer",
      date: req.created_at,
      title: "Transfer Requested",
      description: `Transfer from ${fromName} to ${toName} requested. Reason: ${req.reason || "—"}`,
      actor: requesterName,
    });

    if (req.approved_at) {
      const approverName = req.approved_by_profile?.full_name || "Manager";
      timeline.push({
        id: `transfer-action-${req.id}`,
        type: "transfer",
        date: req.approved_at,
        title: req.status === "approved" ? "Transfer Approved" : "Transfer Rejected",
        description: req.status === "approved" 
          ? `Transfer approved and completed.` 
          : `Transfer request rejected. Reason: ${req.rejection_reason || "—"}`,
        actor: approverName,
      });
    }
  });

  // Add maintenance requests to timeline
  (asset.maintenance ?? []).forEach((m: any) => {
    const requesterName = m.raised_by_profile?.full_name || "Employee";
    
    timeline.push({
      id: `maint-req-${m.id}`,
      type: "maintenance",
      date: m.created_at,
      title: "Maintenance Requested",
      description: `Issue raised: "${m.issue_description}" (Priority: ${m.priority})`,
      actor: requesterName,
    });

    if (m.approved_at) {
      const approverName = m.approved_by_profile?.full_name || "Manager";
      timeline.push({
        id: `maint-app-${m.id}`,
        type: "maintenance",
        date: m.approved_at,
        title: "Maintenance Approved",
        description: `Request approved. Status changed to 'Under Maintenance'.`,
        actor: approverName,
      });
    }

    if (m.resolved_at) {
      timeline.push({
        id: `maint-res-${m.id}`,
        type: "maintenance",
        date: m.resolved_at,
        title: "Maintenance Resolved",
        description: `Resolved. Notes: ${m.resolution_notes || "—"}`,
        actor: m.technician_name || "Technician",
      });
    }
  });

  // Add bookings to timeline
  (asset.bookings ?? []).forEach((b: any) => {
    const bookerName = b.booker?.full_name || "Employee";
    const startStr = new Date(b.start_time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const endStr = new Date(b.end_time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

    timeline.push({
      id: `booking-created-${b.id}`,
      type: "booking",
      date: b.created_at,
      title: "Resource Booked",
      description: `Booked for "${b.purpose || "—"}" from ${startStr} to ${endStr}. Status: ${b.status}`,
      actor: bookerName,
    });
  });

  // Add manual status/overrides activity logs to timeline
  (logs ?? []).forEach((log: any) => {
    const actorName = log.actor?.full_name || "System";
    
    // Only map actions that represent transitions, manual edits, or creation
    if (log.action === "asset.created" || log.action === "asset.status_transition" || log.action === "asset.updated") {
      let desc = "";
      let title = "";
      
      if (log.action === "asset.created") {
        title = "Asset Registered";
        desc = "Asset registered in system database.";
      } else if (log.action === "asset.status_transition") {
        title = "Status Transition";
        desc = `Manual status override from '${log.details?.from}' to '${log.details?.to}'.`;
      } else {
        title = "Asset Updated";
        desc = "Asset details updated.";
      }

      timeline.push({
        id: `log-${log.id}`,
        type: "activity",
        date: log.created_at,
        title,
        description: desc,
        actor: actorName,
      });
    }
  });

  // Sort timeline chronologically (newest first)
  const sortedTimeline = timeline.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return {
    data: {
      ...asset,
      category_name,
      department_name,
      current_holder_name,
      current_allocation_id,
      allocations: sortedAllocations.map((a: any) => ({
        ...a,
        employee_name: a.employee?.full_name ?? null,
        department_name: a.department?.name ?? null,
        allocated_by_name: a.allocator?.full_name ?? null,
      })),
      maintenance: sortedMaintenance.map((m: any) => ({
        ...m,
        raised_by_name: m.raised_by_profile?.full_name ?? null,
        approved_by_name: m.approved_by_profile?.full_name ?? null,
      })),
      timeline: sortedTimeline,
    }
  };
}

export async function generateAssetTag() {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("assets")
    .select("*", { count: "exact", head: true });

  if (error) {
    throw new Error(`Failed to generate asset tag: ${error.message}`);
  }

  const assetCount = count ?? 0;
  return generateReference("AF", assetCount);
}

export async function createAsset(data: {
  name: string;
  categoryId: string;
  assetTag: string;
  serialNumber?: string | null;
  acquisitionDate?: string | null;
  acquisitionCost?: number | null;
  condition?: "new" | "good" | "fair" | "poor" | "damaged";
  location?: string | null;
  departmentId?: string | null;
  isBookable?: boolean;
  photoUrl?: string | null;
  customFieldValues?: Record<string, any>;
  notes?: string | null;
}) {
  const supabase = await createClient();

  // Check role: manager or admin required
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "asset_manager")) {
    return { error: "Asset manager or Administrator access required" };
  }

  // Insert asset
  const { data: asset, error } = await supabase
    .from("assets")
    .insert({
      name: data.name,
      category_id: data.categoryId,
      asset_tag: data.assetTag,
      serial_number: data.serialNumber || null,
      acquisition_date: data.acquisitionDate || null,
      acquisition_cost: data.acquisitionCost || null,
      condition: data.condition || "good",
      location: data.location || null,
      department_id: data.departmentId || null,
      is_bookable: data.isBookable ?? false,
      status: "available",
      photo_url: data.photoUrl || null,
      custom_field_values: data.customFieldValues || {},
      notes: data.notes || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  // Write activity log
  await supabase.from("activity_logs").insert({
    actor_id: user.id,
    action: "asset.created",
    entity_type: "asset",
    entity_id: asset.id,
    details: {
      asset_tag: asset.asset_tag,
      name: asset.name,
    },
  });

  revalidatePath("/assets");
  return { success: true, id: asset.id };
}

export async function updateAsset(
  id: string,
  data: {
    name: string;
    categoryId: string;
    serialNumber?: string | null;
    acquisitionDate?: string | null;
    acquisitionCost?: number | null;
    condition?: "new" | "good" | "fair" | "poor" | "damaged";
    location?: string | null;
    departmentId?: string | null;
    isBookable?: boolean;
    photoUrl?: string | null;
    customFieldValues?: Record<string, any>;
    notes?: string | null;
  }
) {
  const supabase = await createClient();

  // Check role: manager or admin required
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "asset_manager")) {
    return { error: "Asset manager or Administrator access required" };
  }

  // Update asset
  const { error } = await supabase
    .from("assets")
    .update({
      name: data.name,
      category_id: data.categoryId,
      serial_number: data.serialNumber || null,
      acquisition_date: data.acquisitionDate || null,
      acquisition_cost: data.acquisitionCost || null,
      condition: data.condition,
      location: data.location || null,
      department_id: data.departmentId || null,
      is_bookable: data.isBookable ?? false,
      photo_url: data.photoUrl || null,
      custom_field_values: data.customFieldValues || {},
      notes: data.notes || null,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  // Write activity log
  await supabase.from("activity_logs").insert({
    actor_id: user.id,
    action: "asset.updated",
    entity_type: "asset",
    entity_id: id,
    details: {
      name: data.name,
    },
  });

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  return { success: true };
}

export async function transitionAssetStatus(id: string, newStatus: "available" | "retired" | "disposed") {
  const supabase = await createClient();

  // Check auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profile not found" };
  const userRole = profile.role;

  // Get current asset status
  const { data: asset, error: fetchErr } = await supabase
    .from("assets")
    .select("status, name, asset_tag")
    .eq("id", id)
    .single();

  if (fetchErr || !asset) {
    return { error: "Asset not found" };
  }

  const currentStatus = asset.status;

  // Enforce legal transitions & permissions
  // 1. available -> retired: manager or admin
  // 2. retired -> disposed: manager or admin
  // 3. lost -> available: admin only
  if (newStatus === "retired") {
    if (currentStatus !== "available") {
      return { error: `Invalid transition: cannot transition from '${currentStatus}' to 'retired'` };
    }
    if (userRole !== "admin" && userRole !== "asset_manager") {
      return { error: "Permission denied: only Asset Managers and Admins can retire assets" };
    }
  } else if (newStatus === "disposed") {
    if (currentStatus !== "retired") {
      return { error: `Invalid transition: cannot transition from '${currentStatus}' to 'disposed'` };
    }
    if (userRole !== "admin" && userRole !== "asset_manager") {
      return { error: "Permission denied: only Asset Managers and Admins can dispose assets" };
    }
  } else if (newStatus === "available") {
    if (currentStatus !== "lost") {
      return { error: `Invalid transition: cannot transition from '${currentStatus}' to 'available'` };
    }
    if (userRole !== "admin") {
      return { error: "Permission denied: only Administrators can mark lost assets as found" };
    }
  } else {
    return { error: "Unsupported manual status transition" };
  }

  // Perform update
  const { error: updateErr } = await supabase
    .from("assets")
    .update({ status: newStatus })
    .eq("id", id);

  if (updateErr) {
    return { error: updateErr.message };
  }

  // Write activity log
  await supabase.from("activity_logs").insert({
    actor_id: user.id,
    action: "asset.status_transition",
    entity_type: "asset",
    entity_id: id,
    details: {
      from: currentStatus,
      to: newStatus,
      asset_tag: asset.asset_tag,
      name: asset.name,
    },
  });

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  return { success: true };
}

