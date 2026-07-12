"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ==========================================
// QUERY ACTIONS
// ==========================================

interface GetCyclesFilters {
  status?: string;
}

export async function getAuditCycles(filters?: GetCyclesFilters) {
  const supabase = await createClient();

  let query = supabase
    .from("audit_cycles")
    .select(`
      *,
      scope_department:departments!audit_cycles_scope_department_id_fkey(name),
      creator:profiles!audit_cycles_created_by_fkey(full_name),
      auditors:audit_cycle_auditors(
        id,
        auditor_id,
        auditor:profiles!audit_cycle_auditors_auditor_id_fkey(full_name)
      )
    `);

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  // For each cycle, compute progress (verified + missing + damaged) / total
  if (data && data.length > 0) {
    const cycleIds = data.map((c) => c.id);

    // Fetch all audit_items for these cycles in bulk
    const { data: items } = await supabase
      .from("audit_items")
      .select("audit_cycle_id, result")
      .in("audit_cycle_id", cycleIds);

    const progressMap: Record<string, { total: number; checked: number }> = {};
    if (items) {
      for (const item of items) {
        if (!progressMap[item.audit_cycle_id]) {
          progressMap[item.audit_cycle_id] = { total: 0, checked: 0 };
        }
        progressMap[item.audit_cycle_id].total += 1;
        if (item.result !== "pending") {
          progressMap[item.audit_cycle_id].checked += 1;
        }
      }
    }

    // Attach progress to each cycle
    const enriched = data.map((cycle) => ({
      ...cycle,
      progress: progressMap[cycle.id] || { total: 0, checked: 0 },
    }));

    return { data: enriched };
  }

  return { data: data || [] };
}

export async function getAuditCycleById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("audit_cycles")
    .select(`
      *,
      scope_department:departments!audit_cycles_scope_department_id_fkey(name),
      creator:profiles!audit_cycles_created_by_fkey(full_name),
      closer:profiles!audit_cycles_closed_by_fkey(full_name),
      auditors:audit_cycle_auditors(
        id,
        auditor_id,
        auditor:profiles!audit_cycle_auditors_auditor_id_fkey(full_name, email)
      ),
      items:audit_items(
        id,
        asset_id,
        result,
        notes,
        audited_by,
        audited_at,
        asset:assets(id, name, asset_tag, photo_url, location, status),
        auditor:profiles!audit_items_audited_by_fkey(full_name)
      )
    `)
    .eq("id", id)
    .single();

  if (error) {
    return { error: error.message };
  }

  return { data };
}

// ==========================================
// REFERENCE GENERATION
// ==========================================

export async function generateAuditReference(): Promise<string> {
  return "AUD-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ==========================================
// CREATE AUDIT CYCLE
// ==========================================

interface CreateAuditCyclePayload {
  name: string;
  scopeDepartmentId?: string | null;
  scopeLocation?: string | null;
  startDate: string;
  endDate: string;
  auditorIds: string[];
}

export async function createAuditCycle(payload: CreateAuditCyclePayload) {
  const supabase = await createClient();

  // 1. Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // 2. Role check – admin only
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Only administrators can create audit cycles." };
  }

  const { name, scopeDepartmentId, scopeLocation, startDate, endDate, auditorIds } = payload;

  // Validation
  if (!name.trim()) {
    return { error: "Audit cycle name is required." };
  }

  if (!startDate || !endDate) {
    return { error: "Start and end dates are required." };
  }

  if (!auditorIds || auditorIds.length === 0) {
    return { error: "At least one auditor must be assigned." };
  }

  // 3. Generate reference
  const reference = await generateAuditReference();

  // 4. Insert audit_cycles row (set to 'active' directly per task spec)
  const { data: newCycle, error: insertErr } = await supabase
    .from("audit_cycles")
    .insert({
      reference,
      name: name.trim(),
      scope_department_id: scopeDepartmentId || null,
      scope_location: scopeLocation?.trim() || null,
      start_date: startDate,
      end_date: endDate,
      status: "active",
      created_by: user.id,
    })
    .select()
    .single();

  if (insertErr || !newCycle) {
    return { error: insertErr?.message || "Failed to create audit cycle." };
  }

  // 5. Insert audit_cycle_auditors rows
  const auditorRows = auditorIds.map((auditorId) => ({
    audit_cycle_id: newCycle.id,
    auditor_id: auditorId,
  }));

  const { error: auditorInsertErr } = await supabase
    .from("audit_cycle_auditors")
    .insert(auditorRows);

  if (auditorInsertErr) {
    return { error: auditorInsertErr.message };
  }

  // 6. Auto-populate audit_items: one row per matching asset
  let assetQuery = supabase
    .from("assets")
    .select("id");

  if (scopeDepartmentId) {
    assetQuery = assetQuery.eq("department_id", scopeDepartmentId);
  }

  if (scopeLocation?.trim()) {
    assetQuery = assetQuery.ilike("location", `%${scopeLocation.trim()}%`);
  }

  const { data: matchingAssets, error: assetsErr } = await assetQuery;

  if (assetsErr) {
    return { error: assetsErr.message };
  }

  if (matchingAssets && matchingAssets.length > 0) {
    const itemRows = matchingAssets.map((asset) => ({
      audit_cycle_id: newCycle.id,
      asset_id: asset.id,
      result: "pending",
    }));

    const { error: itemsInsertErr } = await supabase
      .from("audit_items")
      .insert(itemRows);

    if (itemsInsertErr) {
      return { error: itemsInsertErr.message };
    }
  }

  // 7. Write notification (type 'audit_assigned') to each auditor
  const notificationPayload = auditorIds.map((auditorId) => ({
    user_id: auditorId,
    title: "Audit Assignment",
    message: `You have been assigned as an auditor for audit cycle "${name}" (${reference}).`,
    type: "audit_assigned",
    related_type: "audit",
    related_id: newCycle.id,
  }));

  await supabase.from("notifications").insert(notificationPayload);

  // 8. Activity log
  await supabase.from("activity_logs").insert({
    actor_id: user.id,
    action: "audit_cycle_created",
    entity_type: "audit_cycle",
    entity_id: newCycle.id,
    details: {
      reference,
      name,
      scope_department_id: scopeDepartmentId || null,
      scope_location: scopeLocation || null,
      auditor_count: auditorIds.length,
      asset_count: matchingAssets?.length || 0,
    },
  });

  revalidatePath("/audits");

  return { success: true, data: newCycle };
}

// ==========================================
// SUBMIT AUDIT ITEM RESULT
// ==========================================

interface SubmitAuditItemResultPayload {
  auditItemId: string;
  result: "verified" | "missing" | "damaged";
  notes?: string;
}

export async function submitAuditItemResult(payload: SubmitAuditItemResultPayload) {
  const supabase = await createClient();

  // 1. Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // 2. Fetch the audit item + its cycle ID
  const { data: item, error: itemErr } = await supabase
    .from("audit_items")
    .select("id, audit_cycle_id")
    .eq("id", payload.auditItemId)
    .single();

  if (itemErr || !item) {
    return { error: "Audit item not found." };
  }

  // 3. Check cycle is active
  const { data: cycle } = await supabase
    .from("audit_cycles")
    .select("status")
    .eq("id", item.audit_cycle_id)
    .single();

  if (!cycle || cycle.status !== "active") {
    return { error: "This audit cycle is not active." };
  }

  // 4. Permission: caller must be an assigned auditor on this cycle, or admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    const { data: auditorRow } = await supabase
      .from("audit_cycle_auditors")
      .select("id")
      .eq("audit_cycle_id", item.audit_cycle_id)
      .eq("auditor_id", user.id)
      .maybeSingle();

    if (!auditorRow) {
      return { error: "You are not an assigned auditor for this cycle." };
    }
  }

  // 5. Update audit_items row
  const { error: updateErr } = await supabase
    .from("audit_items")
    .update({
      result: payload.result,
      notes: payload.notes?.trim() || null,
      audited_by: user.id,
      audited_at: new Date().toISOString(),
    })
    .eq("id", payload.auditItemId);

  if (updateErr) {
    return { error: updateErr.message };
  }

  revalidatePath(`/audits/${item.audit_cycle_id}`);

  return { success: true };
}

// ==========================================
// CLOSE AUDIT CYCLE
// ==========================================

interface CloseAuditCyclePayload {
  auditCycleId: string;
}

export async function closeAuditCycle(payload: CloseAuditCyclePayload) {
  const supabase = await createClient();

  // 1. Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // 2. Admin-only
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Only administrators can close audit cycles." };
  }

  // 3. Verify cycle exists and is active
  const { data: cycle, error: cycleErr } = await supabase
    .from("audit_cycles")
    .select("id, reference, name, status")
    .eq("id", payload.auditCycleId)
    .single();

  if (cycleErr || !cycle) {
    return { error: "Audit cycle not found." };
  }

  if (cycle.status !== "active") {
    return { error: "Only active audit cycles can be closed." };
  }

  // 4. Fetch all audit_items for this cycle
  const { data: items } = await supabase
    .from("audit_items")
    .select("id, asset_id, result, notes")
    .eq("audit_cycle_id", cycle.id);

  // 5. For every item with result='missing', transition the asset to 'lost'
  const missingItems = (items || []).filter((i) => i.result === "missing");
  const damagedItems = (items || []).filter((i) => i.result === "damaged");

  for (const mi of missingItems) {
    await supabase
      .from("assets")
      .update({ status: "lost" })
      .eq("id", mi.asset_id);
  }

  // 6. Close the cycle
  const { error: closeErr } = await supabase
    .from("audit_cycles")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: user.id,
    })
    .eq("id", cycle.id);

  if (closeErr) {
    return { error: closeErr.message };
  }

  // 7. Notify all assigned auditors (type 'audit_cycle_closed')
  const { data: auditors } = await supabase
    .from("audit_cycle_auditors")
    .select("auditor_id")
    .eq("audit_cycle_id", cycle.id);

  if (auditors && auditors.length > 0) {
    const closedNotifs = auditors.map((a) => ({
      user_id: a.auditor_id,
      title: "Audit Cycle Closed",
      message: `Audit cycle "${cycle.name}" (${cycle.reference}) has been closed.`,
      type: "audit_cycle_closed",
      related_type: "audit",
      related_id: cycle.id,
    }));

    await supabase.from("notifications").insert(closedNotifs);
  }

  // 8. For every missing/damaged item, send discrepancy notification to asset_manager/admin
  const discrepancyItems = [...missingItems, ...damagedItems];
  if (discrepancyItems.length > 0) {
    const { data: managers } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["asset_manager", "admin"]);

    if (managers && managers.length > 0) {
      // Fetch asset names for notification messages
      const assetIds = discrepancyItems.map((i) => i.asset_id);
      const { data: assets } = await supabase
        .from("assets")
        .select("id, name, asset_tag")
        .in("id", assetIds);

      const assetMap = new Map((assets || []).map((a) => [a.id, a]));

      const discNotifs: any[] = [];
      for (const item of discrepancyItems) {
        const asset = assetMap.get(item.asset_id);
        const assetLabel = asset ? `${asset.name} (${asset.asset_tag})` : "Unknown Asset";
        for (const m of managers) {
          discNotifs.push({
            user_id: m.id,
            title: `Audit Discrepancy: ${item.result === "missing" ? "Missing" : "Damaged"} Asset`,
            message: `Asset "${assetLabel}" was flagged as ${item.result} during audit "${cycle.name}" (${cycle.reference}).${item.notes ? ` Notes: ${item.notes}` : ""}`,
            type: "audit_discrepancy_flagged",
            related_type: "audit",
            related_id: cycle.id,
          });
        }
      }

      if (discNotifs.length > 0) {
        await supabase.from("notifications").insert(discNotifs);
      }
    }
  }

  // 9. Activity log
  await supabase.from("activity_logs").insert({
    actor_id: user.id,
    action: "audit_cycle_closed",
    entity_type: "audit_cycle",
    entity_id: cycle.id,
    details: {
      reference: cycle.reference,
      name: cycle.name,
      missing_count: missingItems.length,
      damaged_count: damagedItems.length,
      assets_marked_lost: missingItems.map((i) => i.asset_id),
    },
  });

  revalidatePath("/audits");
  revalidatePath(`/audits/${cycle.id}`);

  return { success: true, missingCount: missingItems.length, damagedCount: damagedItems.length };
}
