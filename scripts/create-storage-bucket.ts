import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import dns from "dns";

dns.setDefaultResultOrder("ipv4first");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log("Creating storage bucket 'asset-photos'...");
  const { data: data1, error: error1 } = await supabase.storage.createBucket("asset-photos", {
    public: true,
    allowedMimeTypes: ["image/*"],
  });

  if (error1) {
    console.error("asset-photos creation message:", error1.message);
  } else {
    console.log("asset-photos created successfully:", data1);
  }

  console.log("Creating storage bucket 'maintenance-photos'...");
  const { data: data2, error: error2 } = await supabase.storage.createBucket("maintenance-photos", {
    public: true,
    allowedMimeTypes: ["image/*"],
  });

  if (error2) {
    console.error("maintenance-photos creation message:", error2.message);
  } else {
    console.log("maintenance-photos created successfully:", data2);
  }
}

run();
