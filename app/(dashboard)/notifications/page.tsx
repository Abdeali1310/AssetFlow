import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NotificationsClient } from "@/components/notifications/NotificationsClient";
import type { UserRole } from "@/lib/types";

export const metadata = {
  title: "Notifications & Activity Log | AssetFlow",
};

export default async function NotificationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const userData = {
    id: user.id,
    full_name: profile.full_name as string,
    email: profile.email as string,
    role: profile.role as UserRole,
    avatar_url: profile.avatar_url as string | null,
  };

  return <NotificationsClient user={userData} />;
}
