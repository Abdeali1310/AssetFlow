"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Department } from "@/lib/types";

export async function getDepartments() {
  const supabase = await createClient();

  // Query departments and join head's full_name and parent department name.
  // We can query all departments, and resolve parent departments/heads either in SQL or JS.
  // Let's do a join query:
  const { data: depts, error } = await supabase
    .from("departments")
    .select(`
      *,
      head:profiles!departments_head_fk(full_name),
      parent:departments!parent_department_id(name)
    `)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch departments: ${error.message}`);
  }

  // Format the returned data to match Department interface with joined fields
  return (depts ?? []).map((d: any) => ({
    ...d,
    head_name: d.head?.full_name ?? null,
    parent_department_name: d.parent?.name ?? null,
  })) as Department[];
}

export async function createDepartment(data: {
  name: string;
  code: string;
  parentDepartmentId?: string | null;
  headId?: string | null;
}) {
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

  const { error } = await supabase.from("departments").insert({
    name: data.name,
    code: data.code.toUpperCase(),
    parent_department_id: data.parentDepartmentId || null,
    head_id: data.headId || null,
    status: "active",
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/org-setup");
  return { success: true };
}

export async function updateDepartment(
  id: string,
  data: {
    name: string;
    code: string;
    parentDepartmentId?: string | null;
    headId?: string | null;
    status?: "active" | "inactive";
  }
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
    .from("departments")
    .update({
      name: data.name,
      code: data.code.toUpperCase(),
      parent_department_id: data.parentDepartmentId || null,
      head_id: data.headId || null,
      status: data.status,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/org-setup");
  return { success: true };
}

export async function toggleDepartmentStatus(id: string) {
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

  const { data: dept } = await supabase
    .from("departments")
    .select("status")
    .eq("id", id)
    .single();

  if (!dept) throw new Error("Department not found");

  const newStatus = dept.status === "active" ? "inactive" : "active";

  const { error } = await supabase
    .from("departments")
    .update({ status: newStatus })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/org-setup");
  return { success: true };
}
