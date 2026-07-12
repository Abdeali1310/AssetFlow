import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAssetById } from "@/lib/actions/assets";
import { getCategories } from "@/lib/actions/categories";
import { getDepartments } from "@/lib/actions/departments";
import { AssetDetailClient } from "@/components/assets/AssetDetailClient";
import type { UserRole } from "@/lib/types";

interface AssetDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AssetDetailPage({ params }: AssetDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Verify auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get active profile role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // Retrieve Asset by ID
  const { data: asset, error } = await getAssetById(id);
  if (error || !asset) {
    notFound();
  }

  // Load lookup tables for edit mode form dropdowns
  const categories = await getCategories();
  const departments = await getDepartments();

  return (
    <AssetDetailClient
      asset={asset}
      categories={categories}
      departments={departments}
      currentUserRole={profile.role as UserRole}
    />
  );
}
