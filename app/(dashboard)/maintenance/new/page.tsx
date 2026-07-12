import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MaintenanceForm } from "@/components/maintenance/MaintenanceForm";

type SearchParams = Promise<{
  assetId?: string;
}>;

interface NewMaintenancePageProps {
  searchParams: SearchParams;
}

export default async function NewMaintenancePage(props: NewMaintenancePageProps) {
  const supabase = await createClient();

  // 1. Get user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Fetch search parameters
  const resolvedParams = await props.searchParams;
  const { assetId } = resolvedParams;

  // 3. Load all assets
  const { data: assets } = await supabase
    .from("assets")
    .select("id, name, asset_tag")
    .order("name");

  return (
    <div className="py-6">
      <MaintenanceForm
        assets={assets || []}
        prefilledAssetId={assetId}
      />
    </div>
  );
}
