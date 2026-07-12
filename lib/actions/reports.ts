"use server";

import { createClient } from "@/lib/supabase/server";

// ==========================================
// HELPERS
// ==========================================
async function getRoleAndDepartment() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null, departmentId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, department_id")
    .eq("id", user.id)
    .single();

  return { 
    user, 
    role: profile?.role, 
    departmentId: profile?.department_id 
  };
}

// ==========================================
// REPORT QUERIES
// ==========================================

export async function getAssetUtilization() {
  const { user, role, departmentId } = await getRoleAndDepartment();
  if (!user) return { error: "Unauthorized" };

  const supabase = await createClient();
  
  // 90 days ago
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString();

  // 1. Fetch assets
  let assetQuery = supabase.from("assets").select("id, name, asset_tag, is_bookable");
  if (role === "department_head" && departmentId) {
    assetQuery = assetQuery.eq("department_id", departmentId);
  }
  const { data: assets, error: assetErr } = await assetQuery;
  if (assetErr) return { error: assetErr.message };
  
  if (!assets || assets.length === 0) return { data: { mostUsed: [], idle: [] } };
  
  const assetIds = assets.map(a => a.id);
  const assetMap = new Map(assets.map(a => [a.id, a]));

  // 2. Fetch allocations in last 90 days
  const { data: allocations } = await supabase
    .from("asset_allocations")
    .select("asset_id, allocated_at, returned_at")
    .in("asset_id", assetIds)
    .or(`returned_at.is.null,returned_at.gte.${ninetyDaysAgoStr}`);

  // 3. Fetch bookings in last 90 days
  const { data: bookings } = await supabase
    .from("bookings")
    .select("asset_id, start_time, end_time")
    .in("asset_id", assetIds)
    .gte("end_time", ninetyDaysAgoStr)
    .not("status", "eq", "cancelled");

  const utilization: Record<string, number> = {};
  
  for (const assetId of assetIds) {
    utilization[assetId] = 0;
  }

  // Calculate allocation days
  for (const alloc of allocations || []) {
    const start = new Date(Math.max(new Date(alloc.allocated_at).getTime(), ninetyDaysAgo.getTime()));
    const end = alloc.returned_at ? new Date(alloc.returned_at) : new Date();
    const days = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    utilization[alloc.asset_id] += days;
  }

  // Calculate booking days
  for (const bkg of bookings || []) {
    const start = new Date(Math.max(new Date(bkg.start_time).getTime(), ninetyDaysAgo.getTime()));
    const end = new Date(bkg.end_time);
    const days = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    utilization[bkg.asset_id] += days;
  }

  // Format and sort
  const results = assets.map(a => ({
    id: a.id,
    name: a.name,
    asset_tag: a.asset_tag,
    is_bookable: a.is_bookable,
    utilizedDays: Math.min(90, Math.round(utilization[a.id] * 10) / 10), // Cap at 90
    utilizationPct: Math.min(100, Math.round((utilization[a.id] / 90) * 100)),
  }));

  results.sort((a, b) => b.utilizedDays - a.utilizedDays);

  const mostUsed = results.slice(0, 10);
  
  // For idle, we prefer items with 0 utilization
  const idleAssets = [...results].sort((a, b) => a.utilizedDays - b.utilizedDays);
  const idle = idleAssets.slice(0, 10);

  return { data: { mostUsed, idle } };
}

export async function getMaintenanceFrequency(dateFrom?: string, dateTo?: string) {
  const { user, role, departmentId } = await getRoleAndDepartment();
  if (!user) return { error: "Unauthorized" };

  const supabase = await createClient();

  // First fetch assets to respect department scoping if needed
  let assetQuery = supabase.from("assets").select("id, name, asset_tag, category:asset_categories(name)");
  if (role === "department_head" && departmentId) {
    assetQuery = assetQuery.eq("department_id", departmentId);
  }
  const { data: assets } = await assetQuery;
  if (!assets || assets.length === 0) return { data: { byCategory: [], topAssets: [] } };

  const assetIds = assets.map(a => a.id);
  const assetMap = new Map(assets.map(a => [a.id, a]));

  // Fetch maintenance requests
  let mrQuery = supabase
    .from("maintenance_requests")
    .select("asset_id, created_at")
    .in("asset_id", assetIds);

  if (dateFrom) mrQuery = mrQuery.gte("created_at", dateFrom);
  if (dateTo) mrQuery = mrQuery.lte("created_at", dateTo);

  const { data: requests, error: reqErr } = await mrQuery;
  if (reqErr) return { error: reqErr.message };

  const categoryCounts: Record<string, number> = {};
  const assetCounts: Record<string, number> = {};

  for (const req of requests || []) {
    const asset = assetMap.get(req.asset_id);
    if (!asset) continue;

    // Asset count
    assetCounts[asset.id] = (assetCounts[asset.id] || 0) + 1;

    // Category count
    const catName = (asset.category as any)?.name || "Uncategorized";
    categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
  }

  const byCategory = Object.entries(categoryCounts).map(([category, count]) => ({
    category,
    count,
  })).sort((a, b) => b.count - a.count);

  const topAssets = Object.entries(assetCounts).map(([assetId, count]) => {
    const a = assetMap.get(assetId)!;
    return {
      id: a.id,
      name: a.name,
      asset_tag: a.asset_tag,
      category: (a.category as any)?.name || "Uncategorized",
      count,
    };
  }).sort((a, b) => b.count - a.count).slice(0, 10);

  return { data: { byCategory, topAssets } };
}

export async function getUpcomingMaintenanceAndRetirement() {
  const { user, role, departmentId } = await getRoleAndDepartment();
  if (!user) return { error: "Unauthorized" };

  const supabase = await createClient();

  // 1. Fetch assets
  let assetQuery = supabase.from("assets").select("id, name, asset_tag, acquisition_date");
  if (role === "department_head" && departmentId) {
    assetQuery = assetQuery.eq("department_id", departmentId);
  }
  const { data: assets } = await assetQuery;
  if (!assets || assets.length === 0) return { data: { openMaintenance: [], nearingRetirement: [] } };

  const assetIds = assets.map(a => a.id);
  const assetMap = new Map(assets.map(a => [a.id, a]));

  // 2. Fetch open maintenance requests
  const { data: openRequests } = await supabase
    .from("maintenance_requests")
    .select("asset_id, status, priority, issue_description")
    .in("asset_id", assetIds)
    .in("status", ["pending", "approved", "in_progress"]);

  const openMaintenance = (openRequests || []).map(req => {
    const a = assetMap.get(req.asset_id)!;
    return {
      id: a.id,
      name: a.name,
      asset_tag: a.asset_tag,
      status: req.status,
      priority: req.priority,
      issue: req.issue_description,
    };
  });

  // 3. Calculate "nearing retirement" (Heuristic: acquisition_date > 4 years ago)
  const fourYearsAgo = new Date();
  fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);
  
  const nearingRetirement = assets
    .filter(a => a.acquisition_date && new Date(a.acquisition_date) < fourYearsAgo)
    .map(a => {
      const ageMs = new Date().getTime() - new Date(a.acquisition_date).getTime();
      const ageYears = Math.round((ageMs / (1000 * 60 * 60 * 24 * 365.25)) * 10) / 10;
      return {
        id: a.id,
        name: a.name,
        asset_tag: a.asset_tag,
        acquisition_date: a.acquisition_date,
        age_years: ageYears,
      };
    })
    .sort((a, b) => b.age_years - a.age_years)
    .slice(0, 15);

  return { data: { openMaintenance, nearingRetirement } };
}

export async function getDepartmentAllocationSummary() {
  const { user, role, departmentId } = await getRoleAndDepartment();
  if (!user) return { error: "Unauthorized" };

  const supabase = await createClient();

  // Determine departments to include
  let deptQuery = supabase.from("departments").select("id, name");
  if (role === "department_head" && departmentId) {
    deptQuery = deptQuery.eq("id", departmentId);
  }
  const { data: departments } = await deptQuery;
  
  if (!departments || departments.length === 0) return { data: [] };

  const deptIds = departments.map(d => d.id);
  const deptMap = new Map(departments.map(d => [d.id, d.name]));

  // Fetch all assets in these departments
  const { data: assets } = await supabase
    .from("assets")
    .select("id, department_id, status")
    .in("department_id", deptIds);

  const stats: Record<string, { total: number, allocated: number }> = {};
  for (const dept of departments) {
    stats[dept.id] = { total: 0, allocated: 0 };
  }

  for (const a of assets || []) {
    if (a.department_id && stats[a.department_id]) {
      stats[a.department_id].total += 1;
      if (a.status === "allocated") {
        stats[a.department_id].allocated += 1;
      }
    }
  }

  const results = departments.map(d => {
    const s = stats[d.id];
    const pct = s.total > 0 ? Math.round((s.allocated / s.total) * 100) : 0;
    return {
      id: d.id,
      name: d.name,
      total_assets: s.total,
      allocated_assets: s.allocated,
      allocation_pct: pct,
    };
  }).sort((a, b) => b.allocation_pct - a.allocation_pct);

  return { data: results };
}

export async function getBookingHeatmap(dateFrom?: string, dateTo?: string) {
  const { user, role, departmentId } = await getRoleAndDepartment();
  if (!user) return { error: "Unauthorized" };

  const supabase = await createClient();

  let assetQuery = supabase.from("assets").select("id").eq("is_bookable", true);
  if (role === "department_head" && departmentId) {
    assetQuery = assetQuery.eq("department_id", departmentId);
  }
  const { data: assets } = await assetQuery;
  if (!assets || assets.length === 0) return { data: [] };

  const assetIds = assets.map(a => a.id);

  let bkgQuery = supabase
    .from("bookings")
    .select("start_time, end_time")
    .in("asset_id", assetIds)
    .not("status", "eq", "cancelled");

  if (dateFrom) bkgQuery = bkgQuery.gte("start_time", dateFrom);
  else {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    bkgQuery = bkgQuery.gte("start_time", ninetyDaysAgo.toISOString());
  }
  
  if (dateTo) bkgQuery = bkgQuery.lte("end_time", dateTo);

  const { data: bookings } = await bkgQuery;

  // 7 days x 24 hours grid
  // 0 = Sunday, 1 = Monday, etc.
  const grid: Record<string, number> = {};
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      grid[`${d}-${h}`] = 0;
    }
  }

  for (const bkg of bookings || []) {
    const start = new Date(bkg.start_time);
    const end = new Date(bkg.end_time);
    
    // We increment every hour block that this booking overlaps.
    // For simplicity, we just iterate hour by hour from start to end.
    let current = new Date(start);
    current.setMinutes(0, 0, 0); // truncate to hour

    while (current < end) {
      const day = current.getDay();
      const hour = current.getHours();
      grid[`${day}-${hour}`] = (grid[`${day}-${hour}`] || 0) + 1;
      
      // Move to next hour
      current.setHours(current.getHours() + 1);
    }
  }

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const heatmapData = [];

  for (let h = 0; h < 24; h++) {
    const row: any = { hour: `${h.toString().padStart(2, "0")}:00` };
    for (let d = 0; d < 7; d++) {
      row[days[d]] = grid[`${d}-${h}`];
    }
    heatmapData.push(row);
  }

  return { data: heatmapData };
}
