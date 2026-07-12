import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import type { UserRole } from "@/lib/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the user's profile (role, name, avatar)
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // Fetch unread notification count
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  const userData = {
    full_name: profile.full_name as string,
    email: profile.email as string,
    role: profile.role as UserRole,
    avatar_url: profile.avatar_url as string | null,
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar user={userData} unreadCount={unreadCount ?? 0} />
      <Topbar user={userData} unreadCount={unreadCount ?? 0} />
      <main className="ml-[260px] pt-16">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
