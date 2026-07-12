import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDepartments } from "@/lib/actions/departments";
import { getCategories } from "@/lib/actions/categories";
import { getEmployees } from "@/lib/actions/employees";
import { OrgSetupClient } from "./OrgSetupClient";
import type { UserRole } from "@/lib/types";

export default async function OrgSetupPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verify Admin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role as UserRole) !== "admin") {
    // Redirect non-admin with a message
    redirect("/dashboard?error=Access+denied.+Administrator+access+required.");
  }

  // Fetch departments, categories, and employees list
  const departments = await getDepartments();
  const categories = await getCategories();
  const employees = await getEmployees();

  // Fetch active eligible department heads
  const { data: eligibleHeads } = await supabase
    .from("profiles")
    .select("id, full_name, role, email")
    .eq("status", "active")
    .in("role", ["admin", "asset_manager", "department_head"])
    .order("full_name", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Organization Setup
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage departments, asset categories, and the employee directory.
        </p>
      </div>

      <OrgSetupClient
        initialDepartments={departments}
        initialCategories={categories}
        initialEmployees={employees}
        eligibleHeads={eligibleHeads ?? []}
      />
    </div>
  );
}
