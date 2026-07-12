"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createBooking, cancelBooking } from "@/lib/actions/bookings";
import {
  CalendarDays,
  Clock,
  Bookmark,
  Boxes,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

interface BookingFormProps {
  bookableAssets: any[];
  prefilledAssetId?: string;
  prefilledStart?: string;
  prefilledEnd?: string;
  rescheduleId?: string;
  rescheduleBooking?: any;
}

export function BookingForm({
  bookableAssets,
  prefilledAssetId = "",
  prefilledStart = "",
  prefilledEnd = "",
  rescheduleId = "",
  rescheduleBooking = null,
}: BookingFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // State
  const [assetId, setAssetId] = useState(prefilledAssetId);
  const [purpose, setPurpose] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // Error/Overlap State
  const [formError, setFormError] = useState<string | null>(null);
  const [conflictRange, setConflictRange] = useState<{ start: string; end: string } | null>(null);

  // Initialize values
  useEffect(() => {
    // If reschedule, prefill from original booking
    if (rescheduleBooking) {
      setAssetId(rescheduleBooking.asset_id);
      setPurpose(rescheduleBooking.purpose || "");

      const originalStart = new Date(rescheduleBooking.start_time);
      const originalEnd = new Date(rescheduleBooking.end_time);

      // Format date YYYY-MM-DD
      const yyyy = originalStart.getFullYear();
      const mm = String(originalStart.getMonth() + 1).padStart(2, "0");
      const dd = String(originalStart.getDate()).padStart(2, "0");
      setDate(`${yyyy}-${mm}-${dd}`);

      // Format time HH:MM
      const startHH = String(originalStart.getHours()).padStart(2, "0");
      const startMM = String(originalStart.getMinutes()).padStart(2, "0");
      setStartTime(`${startHH}:${startMM}`);

      const endHH = String(originalEnd.getHours()).padStart(2, "0");
      const endMM = String(originalEnd.getMinutes()).padStart(2, "0");
      setEndTime(`${endHH}:${endMM}`);
    } else {
      // Normal path with prefilled parameters
      if (prefilledAssetId) {
        setAssetId(prefilledAssetId);
      } else if (bookableAssets.length > 0) {
        setAssetId(bookableAssets[0].id);
      }

      if (prefilledStart) {
        const start = new Date(prefilledStart);
        const yyyy = start.getFullYear();
        const mm = String(start.getMonth() + 1).padStart(2, "0");
        const dd = String(start.getDate()).padStart(2, "0");
        setDate(`${yyyy}-${mm}-${dd}`);

        const hh = String(start.getHours()).padStart(2, "0");
        const mins = String(start.getMinutes()).padStart(2, "0");
        setStartTime(`${hh}:${mins}`);
      }

      if (prefilledEnd) {
        const end = new Date(prefilledEnd);
        const hh = String(end.getHours()).padStart(2, "0");
        const mins = String(end.getMinutes()).padStart(2, "0");
        setEndTime(`${hh}:${mins}`);
      }
    }
  }, [bookableAssets, prefilledAssetId, prefilledStart, prefilledEnd, rescheduleBooking]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setConflictRange(null);

    if (!assetId) {
      setFormError("Please select a resource to book.");
      return;
    }

    if (!date || !startTime || !endTime) {
      setFormError("Date, Start Time, and End Time are required.");
      return;
    }

    // Combine Date + Time
    const startISO = new Date(`${date}T${startTime}`).toISOString();
    const endISO = new Date(`${date}T${endTime}`).toISOString();

    if (new Date(startISO) >= new Date(endISO)) {
      setFormError("Start time must be strictly before end time.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createBooking({
          assetId,
          startTime: startISO,
          endTime: endISO,
          purpose,
        });

        if (res.error) {
          if (res.error.code === "OVERLAP" && res.error.meta) {
            setConflictRange({
              start: res.error.meta.conflictingStart,
              end: res.error.meta.conflictingEnd,
            });
            setFormError(res.error.message);
          } else {
            setFormError(res.error.message || "An unexpected error occurred.");
          }
          return;
        }

        // If this is a reschedule, cancel the old booking now
        if (rescheduleId) {
          await cancelBooking({
            bookingId: rescheduleId,
            reason: `Rescheduled to new booking reference: ${res.data?.reference}`,
          });
          toast.success("Booking rescheduled successfully");
        } else {
          toast.success("Booking confirmed successfully.");
        }

        router.push("/bookings");
        router.refresh();
      } catch (err: any) {
        setFormError("Failed to submit booking. Check your connection.");
      }
    });
  };

  const formatConflictTime = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-card border border-border rounded-xl shadow-xs overflow-hidden">
      <div className="border-b border-border p-5 bg-muted/10">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          {rescheduleId ? (
            <>
              <RefreshCw className="h-5 w-5 text-primary" />
              Reschedule Resource Booking
            </>
          ) : (
            <>
              <CalendarDays className="h-5 w-5 text-primary" />
              Book Company Resource
            </>
          )}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {rescheduleId
            ? `Rescheduling booking reference "${rescheduleBooking?.reference}". A new booking record will be created and the old one cancelled.`
            : "Reserve a bookable resource for a specified date and time window."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {/* Error Alert Display */}
        {formError && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2.5 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">{formError}</p>
              {conflictRange && (
                <p className="text-[11px] opacity-90 leading-relaxed">
                  This resource is already booked from{" "}
                  <strong className="underline">
                    {formatConflictTime(conflictRange.start)}
                  </strong>{" "}
                  to{" "}
                  <strong className="underline">
                    {formatConflictTime(conflictRange.end)}
                  </strong>{" "}
                  on this day. Choose a different time.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Resource Selection */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Boxes className="h-3 w-3" />
            Resource / Asset
          </label>
          <select
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            disabled={!!prefilledAssetId || !!rescheduleId}
            className="w-full text-xs bg-background border border-border rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:bg-muted disabled:text-muted-foreground cursor-pointer"
          >
            <option value="" disabled>
              Select a resource...
            </option>
            {bookableAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name} ({asset.asset_tag})
              </option>
            ))}
          </select>
        </div>

        {/* Date Selection */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            Booking Date
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-xs"
            required
          />
        </div>

        {/* Time Windows */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Start Time
            </label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="text-xs"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              End Time
            </label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="text-xs"
              required
            />
          </div>
        </div>

        {/* Purpose / Reservation notes */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Bookmark className="h-3 w-3" />
            Purpose of Reservation
          </label>
          <Textarea
            placeholder="Describe what you need this resource for (e.g. testing, developer workstation, lab demonstration)..."
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="text-xs min-h-[90px] resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-border/80">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? (
              rescheduleId ? (
                "Rescheduling..."
              ) : (
                "Confirming..."
              )
            ) : rescheduleId ? (
              <>
                Confirm Reschedule
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Confirm Booking
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
