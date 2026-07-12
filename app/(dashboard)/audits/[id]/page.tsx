import React from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuditCycleById } from "@/lib/actions/audits";
import { canViewAudits, canCreateAuditCycle } from "@/lib/permissions";
import { AuditDetailClient } from "@/components/audits/AuditDetailClient";
import type { UserRole } from "@/lib/types";

interface AuditDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AuditDetailPage({ params }: AuditDetailPageProps) {
  const { id } = await params;
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

  if (!canViewAudits(role)) {
    redirect("/dashboard");
  }

  const { data: cycle, error } = await getAuditCycleById(id);

  if (error || !cycle) {
    notFound();
  }

  // Determine if current user is an assigned auditor
  const isAssignedAuditor = (cycle.auditors || []).some(
    (a: any) => a.auditor_id === user.id
  );

  return (
    <AuditDetailClient
      cycle={cycle}
      currentUserRole={role}
      currentUserId={user.id}
      isAssignedAuditor={isAssignedAuditor}
    />
  );
}
