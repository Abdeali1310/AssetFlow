"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getProfiles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name", { ascending: true });

  if (error) {
    return { error: error.message };
  }
  return { data: data || [] };
}


// ==========================================
// NOTIFICATIONS
// ==========================================

export async function getUnreadNotificationCount(userId: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    console.error("Error fetching unread count:", error);
    return 0;
  }
  return count || 0;
}

export async function getRecentNotifications(userId: string, limit = 5) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { error: error.message };
  }
  return { data: data || [] };
}

interface NotificationFilters {
  type?: string;
  isRead?: boolean;
}

export async function getAllNotifications(userId: string, filters?: NotificationFilters) {
  const supabase = await createClient();
  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId);

  if (filters?.type && filters.type !== "all") {
    query = query.eq("type", filters.type);
  }

  if (filters?.isRead !== undefined) {
    query = query.eq("is_read", filters.isRead);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }
  return { data: data || [] };
}

export async function markNotificationRead(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/notifications");
  return { success: true };
}

export async function markAllNotificationsRead(userId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/notifications");
  return { success: true };
}

// ==========================================
// ACTIVITY LOG
// ==========================================

interface ActivityLogFilters {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function getActivityLog(filters?: ActivityLogFilters) {
  const supabase = await createClient();

  // 1. Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // 2. Fetch role and department
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, department_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { error: "Profile not found" };
  }

  const role = profile.role;
  const departmentId = profile.department_id;

  let query = supabase
    .from("activity_logs")
    .select(`
      *,
      actor:profiles!activity_logs_actor_id_fkey(full_name, email)
    `);

  // Apply filters first (or we can combine them later)
  if (filters?.entityType) {
    query = query.eq("entity_type", filters.entityType);
  }
  if (filters?.entityId) {
    query = query.eq("entity_id", filters.entityId);
  }
  if (filters?.actorId) {
    query = query.eq("actor_id", filters.actorId);
  }
  if (filters?.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte("created_at", filters.dateTo);
  }

  // Role scoping per architecture.md §2.1
  if (role === "admin") {
    // Admin sees everything, no extra filters
  } else if (role === "asset_manager") {
    // sees their own actions plus assets they manage (all assets/allocations/bookings/maintenance)
    // actor_id = user.id OR entity_type IN ('asset', 'allocation', 'transfer', 'maintenance_request', 'booking')
    // We can use custom filter
    query = query.or(`actor_id.eq.${user.id},entity_type.in.("asset","allocation","transfer","maintenance_request","booking")`);
  } else if (role === "department_head") {
    // sees their department's activity
    if (!departmentId) {
      return { data: [] }; // no department assigned
    }

    // Fetch department assets and employees
    const { data: deptAssets } = await supabase
      .from("assets")
      .select("id")
      .eq("department_id", departmentId);
    
    const { data: deptEmployees } = await supabase
      .from("profiles")
      .select("id")
      .eq("department_id", departmentId);

    const assetIds = deptAssets?.map((a) => a.id) || [];
    const employeeIds = deptEmployees?.map((e) => e.id) || [];

    if (assetIds.length === 0 && employeeIds.length === 0) {
      return { data: [] };
    }

    // Construct list of conditions
    const conditions: string[] = [];

    // Actor is in the department
    if (employeeIds.length > 0) {
      conditions.push(`actor_id.in.(${employeeIds.map(id => `"${id}"`).join(",")})`);
    }

    // Entity is an asset in the department
    if (assetIds.length > 0) {
      conditions.push(`and(entity_type.eq.asset,entity_id.in.(${assetIds.map(id => `"${id}"`).join(",")}))`);
    }

    // Since we also want allocations, bookings, and maintenance related to these assets/employees:
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

    if (allocIds.length > 0) {
      conditions.push(`and(entity_type.eq.allocation,entity_id.in.(${allocIds.map(id => `"${id}"`).join(",")}))`);
    }
    if (bookingIds.length > 0) {
      conditions.push(`and(entity_type.eq.booking,entity_id.in.(${bookingIds.map(id => `"${id}"`).join(",")}))`);
    }
    if (maintIds.length > 0) {
      conditions.push(`and(entity_type.eq.maintenance_request,entity_id.in.(${maintIds.map(id => `"${id}"`).join(",")}))`);
    }

    query = query.or(conditions.join(","));
  } else {
    // employee sees only their own actions
    query = query.eq("actor_id", user.id);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  return { data: data || [] };
}
