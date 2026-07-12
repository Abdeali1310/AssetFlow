"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { cancelBooking } from "@/lib/actions/bookings";
import {
  CalendarDays,
  Clock,
  User,
  Boxes,
  Bookmark,
  ArrowLeft,
  XCircle,
  CheckCircle2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import type { UserRole } from "@/lib/types";

interface BookingDetailClientProps {
  booking: any;
  currentUserRole: UserRole;
  currentUserId: string;
}

export function BookingDetailClient({
  booking,
  currentUserRole,
  currentUserId,
}: BookingDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);

  const isManager = currentUserRole === "admin" || currentUserRole === "asset_manager";
  const isBooker = booking.booked_by === currentUserId;
  const isCancellable = (booking.status === "upcoming" || booking.status === "ongoing") && (isManager || isBooker);

  const formatDateTime = (isoStr: string) => {
    return new Date(isoStr).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleCancelSubmit = () => {
    startTransition(async () => {
      try {
        const res = await cancelBooking({
          bookingId: booking.id,
          reason: "Cancelled from booking detail page.",
        });

        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Booking cancelled successfully.");
          setCancelOpen(false);
          router.push("/bookings");
          router.refresh();
        }
      } catch (err: any) {
        toast.error("Failed to cancel booking");
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back Link */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/bookings")}
        className="text-muted-foreground hover:text-foreground text-xs"
      >
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
        Back to Bookings
      </Button>

      {/* Details Card */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        {/* Header */}
        <div className="border-b border-border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-muted/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-foreground">
                {booking.reference}
              </span>
              {booking.status === "upcoming" && (
                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10 text-[10px] py-0 px-2 font-semibold">
                  Upcoming
                </Badge>
              )}
              {booking.status === "ongoing" && (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/10 text-[10px] py-0 px-2 font-semibold">
                  Ongoing
                </Badge>
              )}
              {booking.status === "completed" && (
                <Badge className="bg-muted text-muted-foreground hover:bg-muted text-[10px] py-0 px-2 font-semibold">
                  Completed
                </Badge>
              )}
              {booking.status === "cancelled" && (
                <Badge className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/10 text-[10px] py-0 px-2 font-semibold">
                  Cancelled
                </Badge>
              )}
            </div>
            <h2 className="text-lg font-bold text-foreground">
              {booking.purpose || "Resource Booking"}
            </h2>
          </div>

          <div className="flex gap-2">
            {isCancellable && (
              <>
                <Link href={`/bookings/new?rescheduleId=${booking.id}`}>
                  <Button variant="outline" size="sm" className="text-xs">
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Reschedule
                  </Button>
                </Link>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelOpen(true)}
                  className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive-foreground"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Content list */}
        <div className="p-5 divide-y divide-border/60 text-xs">
          {/* Resource Details */}
          <div className="py-4 first:pt-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-muted-foreground" />
              <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                Booked Resource
              </span>
            </div>
            <div className="text-right">
              <Link
                href={`/assets/${booking.asset_id}`}
                className="font-bold text-primary hover:underline block"
              >
                {booking.asset?.name}
              </Link>
              <span className="font-mono text-[10px] text-muted-foreground">
                {booking.asset?.asset_tag}
              </span>
            </div>
          </div>

          {/* Time range */}
          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                Time Window
              </span>
            </div>
            <div className="text-right space-y-0.5">
              <div>
                <span className="text-muted-foreground">Start:</span>{" "}
                <span className="font-semibold text-foreground">
                  {formatDateTime(booking.start_time)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">End:</span>{" "}
                <span className="font-semibold text-foreground">
                  {formatDateTime(booking.end_time)}
                </span>
              </div>
            </div>
          </div>

          {/* Booker profile */}
          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                Reserved By
              </span>
            </div>
            <div className="text-right">
              <span className="font-semibold text-foreground block">
                {booking.booker?.full_name}
              </span>
              <span className="text-muted-foreground">{booking.booker?.email}</span>
            </div>
          </div>

          {/* Created at date */}
          <div className="py-4 last:pb-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                Created Date
              </span>
            </div>
            <span className="font-semibold text-foreground">
              {formatDateTime(booking.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Cancel dialog */}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel Resource Booking"
        description={`Are you sure you want to cancel the booking with reference code "${booking.reference}"? This action cannot be undone.`}
        onConfirm={handleCancelSubmit}
        confirmText={isPending ? "Cancelling..." : "Cancel Booking"}
        variant="destructive"
      />
    </div>
  );
}
