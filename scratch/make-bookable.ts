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

async function run() {
  // Update assets to be bookable
  const { data, error } = await supabase
    .from("assets")
    .update({ is_bookable: true })
    .eq("status", "available");

  if (error) {
    console.error("Failed to update assets:", error);
  } else {
    console.log("Successfully marked available assets as bookable!");
  }
}

run();
