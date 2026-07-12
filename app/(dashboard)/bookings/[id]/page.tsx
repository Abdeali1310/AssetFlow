import React from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BookingDetailClient } from "@/components/bookings/BookingDetailClient";
import type { UserRole } from "@/lib/types";

interface BookingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function BookingDetailPage({ params }: BookingDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Get user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Get user role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // 3. Fetch booking with relationships
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(`
      *,
      asset:assets(id, name, asset_tag),
      booker:profiles!bookings_booked_by_fkey(full_name, email)
    `)
    .eq("id", id)
    .single();

  if (error || !booking) {
    notFound();
  }

  return (
    <BookingDetailClient
      booking={booking}
      currentUserRole={profile.role as UserRole}
      currentUserId={user.id}
    />
  );
}
