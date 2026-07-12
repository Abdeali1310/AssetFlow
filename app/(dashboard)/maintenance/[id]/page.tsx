import React from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMaintenanceRequestById } from "@/lib/actions/maintenance";
import { MaintenanceDetailClient } from "@/components/maintenance/MaintenanceDetailClient";
import type { UserRole } from "@/lib/types";

interface MaintenanceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MaintenanceDetailPage({ params }: MaintenanceDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Get user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Get user role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // 3. Fetch maintenance request details by ID
  const { data: request, error } = await getMaintenanceRequestById(id);

  if (error || !request) {
    notFound();
  }

  return (
    <MaintenanceDetailClient
      request={request}
      currentUserRole={profile.role as UserRole}
      currentUserId={user.id}
    />
  );
}
