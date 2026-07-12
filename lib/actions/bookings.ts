"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getBookableAssets() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("assets")
    .select("*, category:asset_categories(name)")
    .eq("is_bookable", true)
    .order("name", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  return { data };
}

interface GetBookingsFilters {
  assetId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function getBookings(filters?: GetBookingsFilters) {
  const supabase = await createClient();

  let query = supabase
    .from("bookings")
    .select(`
      *,
      asset:assets(id, name, asset_tag, status, is_bookable),
      booker:profiles!bookings_booked_by_fkey(full_name, email)
    `);

  if (filters?.assetId) {
    query = query.eq("asset_id", filters.assetId);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.dateFrom) {
    query = query.gte("start_time", filters.dateFrom);
  }

  if (filters?.dateTo) {
    query = query.lte("end_time", filters.dateTo);
  }

  const { data, error } = await query.order("start_time", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  return { data };
}

interface CreateBookingPayload {
  assetId: string;
  startTime: string;
  endTime: string;
  purpose?: string;
}

export async function createBooking(payload: CreateBookingPayload) {
  const supabase = await createClient();

  // 1. Verify user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: { message: "Unauthorized" } };
  }

  const { assetId, startTime, endTime, purpose } = payload;

  if (new Date(startTime) >= new Date(endTime)) {
    return { error: { message: "Start time must be before end time." } };
  }

  // 2. Verify asset is bookable
  const { data: asset, error: assetErr } = await supabase
    .from("assets")
    .select("id, name, asset_tag, is_bookable")
    .eq("id", assetId)
    .single();

  if (assetErr || !asset) {
    return { error: { message: "Asset not found" } };
  }

  if (!asset.is_bookable) {
    return { error: { message: "This asset is not marked as bookable." } };
  }

  // 3. Strict Overlap Check (status IN ('upcoming', 'ongoing') and overlapping window)
  const { data: overlapBookings, error: overlapErr } = await supabase
    .from("bookings")
    .select("id, start_time, end_time")
    .eq("asset_id", assetId)
    .in("status", ["upcoming", "ongoing"])
    .lt("start_time", endTime)
    .gt("end_time", startTime);

  if (overlapErr) {
    return { error: { message: overlapErr.message } };
  }

  if (overlapBookings && overlapBookings.length > 0) {
    const conflict = overlapBookings[0];
    return {
      error: {
        code: "OVERLAP",
        message: "This resource is already booked during the selected time window.",
        meta: {
          conflictingStart: conflict.start_time,
          conflictingEnd: conflict.end_time,
        },
      },
    };
  }

  // 4. Generate unique Booking Reference with BKG prefix
  const refCode = "BKG-" + Math.random().toString(36).substring(2, 8).toUpperCase();

  // 5. Insert Booking
  const { data: newBooking, error: insertErr } = await supabase
    .from("bookings")
    .insert({
      asset_id: assetId,
      booked_by: user.id,
      reference: refCode,
      start_time: startTime,
      end_time: endTime,
      purpose: purpose || null,
      status: "upcoming",
    })
    .select()
    .single();

  if (insertErr) {
    return { error: { message: insertErr.message } };
  }

  // 6. Sync bookable asset status in Postgres
  await supabase.rpc("sync_bookable_asset_status", { p_asset_id: assetId });

  // 7. Write activity log
  await supabase.from("activity_logs").insert({
    actor_id: user.id,
    action: "booking.created",
    entity_type: "asset",
    entity_id: assetId,
    details: {
      name: asset.name,
      asset_tag: asset.asset_tag,
      reference: refCode,
      start_time: startTime,
      end_time: endTime,
    },
  });

  // 8. Send notification to booker
  const startStr = new Date(startTime).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const endStr = new Date(endTime).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  await supabase.from("notifications").insert({
    user_id: user.id,
    title: "Booking Confirmed",
    message: `Your booking for "${asset.name}" (${startStr} to ${endStr}) is confirmed. Reference: ${refCode}.`,
    type: "booking_confirmed",
    related_type: "booking",
    related_id: newBooking.id,
  });

  revalidatePath("/bookings");
  revalidatePath(`/assets/${assetId}`);

  return { success: true, data: newBooking };
}

interface CancelBookingPayload {
  bookingId: string;
  reason?: string;
}

export async function cancelBooking(payload: CancelBookingPayload) {
  const supabase = await createClient();

  // 1. Verify user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { bookingId, reason } = payload;

  // 2. Retrieve booking details
  const { data: booking, error: getErr } = await supabase
    .from("bookings")
    .select("*, asset:assets(id, name, asset_tag)")
    .eq("id", bookingId)
    .single();

  if (getErr || !booking) {
    return { error: "Booking record not found." };
  }

  if (booking.status === "cancelled" || booking.status === "completed") {
    return { error: `Booking has already been marked as ${booking.status}.` };
  }

  // 3. Update status to cancelled
  const { error: updateErr } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
    })
    .eq("id", bookingId);

  if (updateErr) {
    return { error: updateErr.message };
  }

  // 4. Sync bookable asset status in Postgres
  await supabase.rpc("sync_bookable_asset_status", { p_asset_id: booking.asset_id });

  // 5. Write activity log
  await supabase.from("activity_logs").insert({
    actor_id: user.id,
    action: "booking.cancelled",
    entity_type: "asset",
    entity_id: booking.asset_id,
    details: {
      name: booking.asset.name,
      asset_tag: booking.asset.asset_tag,
      reference: booking.reference,
      reason: reason || null,
    },
  });

  // 6. Notify booker
  await supabase.from("notifications").insert({
    user_id: booking.booked_by,
    title: "Booking Cancelled",
    message: `Your booking for "${booking.asset.name}" (${new Date(
      booking.start_time
    ).toLocaleDateString()}) has been cancelled.`,
    type: "booking_cancelled",
    related_type: "asset",
    related_id: booking.asset_id,
  });

  revalidatePath("/bookings");
  revalidatePath(`/assets/${booking.asset_id}`);

  return { success: true };
}
