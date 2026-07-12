import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportsClient } from "@/components/reports/ReportsClient";

export const metadata = {
  title: "Reports | AssetFlow",
};

export default async function ReportsPage() {
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

  if (!profile || profile.role === "employee") {
    redirect("/dashboard");
  }

  return <ReportsClient />;
}
