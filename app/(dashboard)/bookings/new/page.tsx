import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBookableAssets } from "@/lib/actions/bookings";
import { BookingForm } from "@/components/bookings/BookingForm";

type SearchParams = Promise<{
  assetId?: string;
  start?: string;
  end?: string;
  rescheduleId?: string;
}>;

interface NewBookingPageProps {
  searchParams: SearchParams;
}

export default async function NewBookingPage(props: NewBookingPageProps) {
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
  const { assetId, start, end, rescheduleId } = resolvedParams;

  // 3. Load bookable assets
  const assetsRes = await getBookableAssets();
  const bookableAssets = assetsRes.data || [];

  // 4. If rescheduling, load the old booking
  let rescheduleBooking = null;
  if (rescheduleId) {
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", rescheduleId)
      .single();

    rescheduleBooking = data;
  }

  return (
    <div className="py-6">
      <BookingForm
        bookableAssets={bookableAssets}
        prefilledAssetId={assetId}
        prefilledStart={start}
        prefilledEnd={end}
        rescheduleId={rescheduleId}
        rescheduleBooking={rescheduleBooking}
      />
    </div>
  );
}
