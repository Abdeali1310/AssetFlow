import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBookableAssets, getBookings } from "@/lib/actions/bookings";
import { BookingsClient } from "@/components/bookings/BookingsClient";
import type { UserRole } from "@/lib/types";

export default async function BookingsPage() {
  const supabase = await createClient();

  // 1. Get user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Fetch current user profile role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // 3. Load lookup data and bookings
  const [assetsRes, bookingsRes] = await Promise.all([
    getBookableAssets(),
    getBookings(),
  ]);

  const bookableAssets = assetsRes.data || [];
  const bookings = bookingsRes.data || [];

  return (
    <BookingsClient
      bookableAssets={bookableAssets}
      bookings={bookings}
      currentUserRole={profile.role as UserRole}
      currentUserId={user.id}
    />
  );
}
