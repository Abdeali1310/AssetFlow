"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Profile, UserRole, UserStatus } from "@/lib/types";

export async function getEmployees(filters?: {
  search?: string;
  role?: string;
  departmentId?: string;
  status?: string;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select(`
      *,
      department:departments!department_id(name)
    `)
    .order("full_name", { ascending: true });

  if (filters?.role) {
    query = query.eq("role", filters.role);
  }
  if (filters?.departmentId) {
    if (filters.departmentId === "none") {
      query = query.is("department_id", null);
    } else {
      query = query.eq("department_id", filters.departmentId);
    }
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data: profiles, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch employees: ${error.message}`);
  }

  let results = (profiles ?? []) as any[];

  // Perform client side search filtering if search term exists
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    results = results.filter(
      (p) =>
        p.full_name?.toLowerCase().includes(searchLower) ||
        p.email?.toLowerCase().includes(searchLower)
    );
  }

  return results.map((p) => ({
    ...p,
    department_name: p.department?.name ?? null,
  })) as (Profile & { department_name?: string })[];
}

export async function updateEmployeeDepartment(
  profileId: string,
  departmentId: string | null
) {
  const supabase = await createClient();

  // Check admin role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    throw new Error("Admin privileges required");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ department_id: departmentId || null })
    .eq("id", profileId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/org-setup");
  return { success: true };
}

export async function promoteEmployee(profileId: string, newRole: UserRole) {
  const supabase = await createClient();

  // Check admin role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    throw new Error("Admin privileges required");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", profileId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/org-setup");
  return { success: true };
}

export async function toggleEmployeeStatus(profileId: string) {
  const supabase = await createClient();

  // Check admin role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    throw new Error("Admin privileges required");
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", profileId)
    .single();

  if (!targetProfile) throw new Error("Employee profile not found");

  const newStatus: UserStatus =
    targetProfile.status === "active" ? "inactive" : "active";

  const { error } = await supabase
    .from("profiles")
    .update({ status: newStatus })
    .eq("id", profileId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/org-setup");
  return { success: true };
}
