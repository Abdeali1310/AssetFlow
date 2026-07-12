import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveAllocations,
  getTransferRequests,
  getReturnHistory,
} from "@/lib/actions/allocations";
import { AllocationsClient } from "@/components/allocations/AllocationsClient";
import type { UserRole } from "@/lib/types";

export default async function AllocationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch current user details
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, department_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // Load page data in parallel
  const [activeAllocRes, transferReqsRes, returnHistRes] = await Promise.all([
    getActiveAllocations(),
    getTransferRequests(),
    getReturnHistory(),
  ]);

  const activeAllocations = activeAllocRes.data || [];
  const transferRequests = transferReqsRes.data || [];
  const returnHistory = returnHistRes.data || [];

  return (
    <AllocationsClient
      activeAllocations={activeAllocations}
      transferRequests={transferRequests}
      returnHistory={returnHistory}
      currentUserRole={profile.role as UserRole}
      currentUserId={user.id}
      currentUserDeptId={profile.department_id || null}
    />
  );
}
