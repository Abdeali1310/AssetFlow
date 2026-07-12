import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuditCycles } from "@/lib/actions/audits";
import { AuditListClient } from "@/components/audits/AuditListClient";
import { canViewAudits } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";

export default async function AuditsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const role = profile.role as UserRole;

  // Employees cannot view audits — redirect to dashboard
  if (!canViewAudits(role)) {
    redirect("/dashboard");
  }

  const { data: cycles } = await getAuditCycles();

  return (
    <AuditListClient
      initialCycles={cycles || []}
      currentUserRole={role}
    />
  );
}
