import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAssets } from "@/lib/actions/assets";
import { getCategories } from "@/lib/actions/categories";
import { getDepartments } from "@/lib/actions/departments";
import { AssetsClient } from "@/components/assets/AssetsClient";
import type { UserRole } from "@/lib/types";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AssetsPage(props: {
  searchParams: SearchParams;
}) {
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

  const userRole = profile.role as UserRole;

  // Resolve searchParams from Next.js (async in Next 15/16)
  const resolvedParams = await props.searchParams;
  const statusParam = typeof resolvedParams.status === "string" ? resolvedParams.status : undefined;
  const categoryParam = typeof resolvedParams.categoryId === "string" ? resolvedParams.categoryId : undefined;

  // Fetch initial assets with initial params (e.g. from dashboard cards)
  const initialAssets = await getAssets({
    status: statusParam,
    categoryId: categoryParam,
  });

  const categories = await getCategories();
  const departments = await getDepartments();

  return (
    <div className="space-y-6">
      <AssetsClient
        initialAssets={initialAssets}
        categories={categories}
        departments={departments}
        currentUserRole={userRole}
        initialStatus={statusParam}
        initialCategoryId={categoryParam}
      />
    </div>
  );
}
