import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/actions/categories";
import { getDepartments } from "@/lib/actions/departments";
import { CreateAssetClient } from "./CreateAssetClient";
import type { UserRole } from "@/lib/types";

export default async function NewAssetPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verify Manager / Admin permissions
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const role = profile.role as UserRole;
  if (role !== "admin" && role !== "asset_manager") {
    redirect("/assets?error=Access+denied.+Asset+Manager+or+Administrator+access+required.");
  }

  const categories = await getCategories();
  const departments = await getDepartments();

  return (
    <CreateAssetClient
      categories={categories}
      departments={departments}
    />
  );
}
