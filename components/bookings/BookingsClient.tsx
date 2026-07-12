"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookingCalendar } from "@/components/bookings/BookingCalendar";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { cancelBooking } from "@/lib/actions/bookings";
import {
  CalendarDays,
  List,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Trash2,
} from "lucide-react";
import type { UserRole } from "@/lib/types";

interface BookingsClientProps {
  bookableAssets: any[];
  bookings: any[];
  currentUserRole: UserRole;
  currentUserId: string;
}

export function BookingsClient({
  bookableAssets,
  bookings,
  currentUserRole,
  currentUserId,
}: BookingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Cancel Confirmation State
  const [cancelState, setCancelState] = useState<{
    open: boolean;
    bookingId: string;
    reference: string;
  }>({
    open: false,
    bookingId: "",
    reference: "",
  });

  const isManager = currentUserRole === "admin" || currentUserRole === "asset_manager";

  // Check if user can cancel booking
  const canCancel = (booking: any) => {
    if (booking.status !== "upcoming" && booking.status !== "ongoing") return false;
    return isManager || booking.booked_by === currentUserId;
  };

  // Format full time range
  const formatTimeRange = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);

    const dateOpt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
    const timeOpt: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

    const datePart = start.toLocaleDateString("en-US", dateOpt);
    const startTimePart = start.toLocaleTimeString("en-US", timeOpt);
    const endTimePart = end.toLocaleTimeString("en-US", timeOpt);

    // If same day
    if (start.toDateString() === end.toDateString()) {
      return `${datePart}, ${startTimePart} – ${endTimePart}`;
    }

    const endDatePart = end.toLocaleDateString("en-US", dateOpt);
    return `${datePart}, ${startTimePart} – ${endDatePart}, ${endTimePart}`;
  };

  const handleCancelConfirm = () => {
    if (!cancelState.bookingId) return;

    startTransition(async () => {
      try {
        const res = await cancelBooking({
          bookingId: cancelState.bookingId,
          reason: "Cancelled from bookings dashboard list.",
        });

        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Booking cancelled successfully.");
          setCancelState((prev) => ({ ...prev, open: false }));
          router.refresh();
        }
      } catch (err: any) {
        toast.error("Failed to cancel booking");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Resource Bookings
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Reserve company assets, laptops, meeting spaces, or testing resources and schedule bookings.
          </p>
        </div>

        <Link href="/bookings/new" className="w-full sm:w-auto">
          <Button size="sm" className="w-full">
            <Plus className="mr-1.5 h-4 w-4" />
            New Booking
          </Button>
        </Link>
      </div>

      {/* Main navigation tabs */}
      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="bg-muted/40 p-1 border border-border/50 rounded-lg">
          <TabsTrigger value="calendar" className="text-xs gap-1.5 px-4">
            <CalendarDays className="h-3.5 w-3.5" />
            Calendar View
          </TabsTrigger>
          <TabsTrigger value="list" className="text-xs gap-1.5 px-4">
            <List className="h-3.5 w-3.5" />
            List View
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
              {bookings.filter((b) => b.status === "upcoming" || b.status === "ongoing").length} active
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Calendar View */}
        <TabsContent value="calendar" className="mt-4">
          <BookingCalendar
            bookableAssets={bookableAssets}
            bookings={bookings}
          />
        </TabsContent>

        {/* Tab 2: List View */}
        <TabsContent value="list" className="mt-4">
          <div className="border border-border rounded-xl bg-card overflow-hidden shadow-xs">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="w-[120px] text-xs font-bold">Reference</TableHead>
                  <TableHead className="text-xs font-bold">Resource</TableHead>
                  <TableHead className="text-xs font-bold">Booked By</TableHead>
                  <TableHead className="text-xs font-bold">Time Range</TableHead>
                  <TableHead className="text-xs font-bold">Status</TableHead>
                  <TableHead className="text-right text-xs font-bold pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-xs text-muted-foreground">
                      No bookings scheduled yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((booking) => {
                    const isCancellable = canCancel(booking);

                    return (
                      <TableRow key={booking.id} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="py-3 font-mono text-[11px] font-semibold text-foreground">
                          {booking.reference}
                        </TableCell>
                        <TableCell className="py-3">
                          <Link
                            href={`/assets/${booking.asset_id}`}
                            className="group flex items-center gap-1.5 font-semibold text-xs text-foreground hover:text-primary transition-colors"
                          >
                            {booking.asset?.name}
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary transition-all" />
                          </Link>
                          <span className="font-mono text-[10px] text-muted-foreground block mt-0.5">
                            {booking.asset?.asset_tag}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-xs text-foreground">
                          {booking.booker?.full_name || "Unknown"}
                          <span className="text-[10px] text-muted-foreground block mt-0.5">
                            {booking.booker?.email}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-xs text-muted-foreground">
                          {formatTimeRange(booking.start_time, booking.end_time)}
                        </TableCell>
                        <TableCell className="py-3">
                          {booking.status === "upcoming" && (
                            <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10 flex items-center gap-1 w-fit text-[10px] font-semibold py-0 px-2">
                              <Clock className="h-3 w-3" /> Upcoming
                            </Badge>
                          )}
                          {booking.status === "ongoing" && (
                            <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/10 flex items-center gap-1 w-fit text-[10px] font-semibold py-0 px-2">
                              <CheckCircle2 className="h-3 w-3" /> Ongoing
                            </Badge>
                          )}
                          {booking.status === "completed" && (
                            <Badge className="bg-muted text-muted-foreground hover:bg-muted flex items-center gap-1 w-fit text-[10px] font-semibold py-0 px-2">
                              Completed
                            </Badge>
                          )}
                          {booking.status === "cancelled" && (
                            <Badge className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/10 flex items-center gap-1 w-fit text-[10px] font-semibold py-0 px-2">
                              <XCircle className="h-3 w-3" /> Cancelled
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-right pr-6">
                          {isCancellable ? (
                            <Button
                              variant="outline"
                              size="icon-xs"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive-foreground"
                              onClick={() =>
                                setCancelState({
                                  open: true,
                                  bookingId: booking.id,
                                  reference: booking.reference,
                                })
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        open={cancelState.open}
        onOpenChange={(op) => setCancelState((prev) => ({ ...prev, open: op }))}
        title="Cancel Resource Booking"
        description={`Are you sure you want to cancel the booking with reference code "${cancelState.reference}"? This action cannot be undone.`}
        onConfirm={handleCancelConfirm}
        confirmText={isPending ? "Cancelling..." : "Yes, Cancel Booking"}
        variant="destructive"
      />
    </div>
  );
}
