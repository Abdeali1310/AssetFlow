import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("--- SIMULATING GET ASSET UTILIZATION ---");

  // 90 days ago
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString();

  // 1. Fetch assets
  const { data: assets, error: assetErr } = await supabase
    .from("assets")
    .select("id, name, asset_tag, is_bookable");
  
  if (assetErr) {
    console.error("Asset error:", assetErr);
    return;
  }
  
  console.log(`Fetched ${assets?.length} assets.`);

  if (!assets || assets.length === 0) {
    console.log("No assets found.");
    return;
  }

  const assetIds = assets.map((a) => a.id);

  // 2. Fetch allocations
  const { data: allocations, error: allocErr } = await supabase
    .from("asset_allocations")
    .select("asset_id, allocated_at, returned_at")
    .in("asset_id", assetIds)
    .or(`returned_at.is.null,returned_at.gte.${ninetyDaysAgoStr}`);

  if (allocErr) {
    console.error("Allocations error:", allocErr);
  } else {
    console.log(`Fetched ${allocations?.length} allocations.`);
  }

  // 3. Fetch bookings
  const { data: bookings, error: bkgErr } = await supabase
    .from("bookings")
    .select("asset_id, start_time, end_time")
    .in("asset_id", assetIds)
    .gte("end_time", ninetyDaysAgoStr)
    .not("status", "eq", "cancelled");

  if (bkgErr) {
    console.error("Bookings error:", bkgErr);
  } else {
    console.log(`Fetched ${bookings?.length} bookings.`);
  }

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

  const results = assets.map((a) => ({
    id: a.id,
    name: a.name,
    asset_tag: a.asset_tag,
    is_bookable: a.is_bookable,
    utilizedDays: Math.min(90, Math.round(utilization[a.id] * 10) / 10),
    utilizationPct: Math.min(100, Math.round((utilization[a.id] / 90) * 100)),
  }));

  results.sort((a, b) => b.utilizedDays - a.utilizedDays);

  console.log("\nTop 5 Most Used Assets:");
  console.log(results.slice(0, 5));

  const idleAssets = [...results].sort((a, b) => a.utilizedDays - b.utilizedDays);
  console.log("\nTop 5 Idle Assets:");
  console.log(idleAssets.slice(0, 5));
}

run().catch(console.error);
