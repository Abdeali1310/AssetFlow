import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRpc() {
  const { data, error } = await supabase.rpc("sync_bookable_asset_status", {
    p_asset_id: "00000000-0000-0000-0000-000000000000",
  });
  console.log("RPC result data:", data);
  console.log("RPC error:", error);
}

checkRpc();
