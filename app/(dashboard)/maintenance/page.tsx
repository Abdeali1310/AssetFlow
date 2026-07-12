import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMaintenanceRequests } from "@/lib/actions/maintenance";
import { MaintenanceClient } from "@/components/maintenance/MaintenanceClient";

export default async function MaintenancePage() {
  const supabase = await createClient();

  // 1. Get user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Fetch requests list
  const { data: requests, error } = await getMaintenanceRequests();

  return (
    <MaintenanceClient
      initialRequests={requests || []}
    />
  );
}
