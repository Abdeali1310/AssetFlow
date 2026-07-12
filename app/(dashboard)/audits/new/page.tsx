import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuditCycleForm } from "@/components/audits/AuditCycleForm";
import { canCreateAuditCycle } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";

export default async function NewAuditPage() {
  const supabase = await createClient();

  // 1. Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Role check — admin only
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const role = profile.role as UserRole;

  if (!canCreateAuditCycle(role)) {
    redirect("/audits");
  }

  // 3. Load departments for scope selector
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .order("name");

  // 4. Load eligible auditors (admin, asset_manager, department_head)
  const { data: eligibleAuditors } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["admin", "asset_manager", "department_head"])
    .order("full_name");

  return (
    <div className="py-6">
      <AuditCycleForm
        departments={departments || []}
        eligibleAuditors={eligibleAuditors || []}
      />
    </div>
  );
}
