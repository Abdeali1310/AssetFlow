"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  User,
  Clock,
  Bookmark,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BookingCalendarProps {
  bookableAssets: any[];
  bookings: any[];
  onSlotClick?: (assetId: string, startTime: string, endTime: string) => void;
}

const START_HOUR = 7; // 7 AM
const END_HOUR = 20; // 8 PM (20:00)
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

export function BookingCalendar({
  bookableAssets,
  bookings,
  onSlotClick,
}: BookingCalendarProps) {
  const router = useRouter();

  // Selected Asset
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");

  // Current calendar week reference date (Monday of the week)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(today.setDate(diff));
  });

  // Set default selected asset if assets are loaded
  useEffect(() => {
    if (bookableAssets.length > 0 && !selectedAssetId) {
      setSelectedAssetId(bookableAssets[0].id);
    }
  }, [bookableAssets, selectedAssetId]);

  // Generate 7 days of the week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + i);
    return date;
  });

  // Week navigation
  const prevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const nextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const setToday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentWeekStart(new Date(today.setDate(diff)));
  };

  // Format header range
  const formatWeekRange = () => {
    const start = weekDays[0];
    const end = weekDays[6];

    const startMonth = start.toLocaleDateString("en-US", { month: "short" });
    const endMonth = end.toLocaleDateString("en-US", { month: "short" });
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    if (startYear !== endYear) {
      return `${startMonth} ${start.getDate()}, ${startYear} – ${endMonth} ${end.getDate()}, ${endYear}`;
    }
    if (startMonth !== endMonth) {
      return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${startYear}`;
    }
    return `${startMonth} ${start.getDate()} – ${end.getDate()}, ${startYear}`;
  };

  // Filter bookings for the selected asset and matching current week
  const filteredBookings = bookings.filter((b) => {
    if (b.asset_id !== selectedAssetId) return false;
    const bStart = new Date(b.start_time);
    const wStart = new Date(currentWeekStart);
    wStart.setHours(0, 0, 0, 0);

    const wEnd = new Date(currentWeekStart);
    wEnd.setDate(currentWeekStart.getDate() + 7);
    wEnd.setHours(23, 59, 59, 999);

    return bStart >= wStart && bStart <= wEnd && b.status !== "cancelled";
  });

  // Get status layout classes
  const getStatusClasses = (status: string) => {
    switch (status) {
      case "ongoing":
        return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/15";
      case "completed":
        return "bg-muted/40 text-muted-foreground border-muted-foreground/20 opacity-70 hover:bg-muted/50";
      case "upcoming":
      default:
        return "bg-blue-500/10 text-blue-700 border-blue-500/30 hover:bg-blue-500/15";
    }
  };

  // Handle click on empty cell slot
  const handleCellClick = (date: Date, hour: number) => {
    if (!selectedAssetId) return;

    // Prefill 1 hour slot
    const startTime = new Date(date);
    startTime.setHours(hour, 0, 0, 0);
    const endTime = new Date(date);
    endTime.setHours(hour + 1, 0, 0, 0);

    const isoStart = startTime.toISOString();
    const isoEnd = endTime.toISOString();

    if (onSlotClick) {
      onSlotClick(selectedAssetId, isoStart, isoEnd);
    } else {
      router.push(`/bookings/new?assetId=${selectedAssetId}&start=${isoStart}&end=${isoEnd}`);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Controls header toolbar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-muted/20 p-4 border border-border/80 rounded-xl">
          {/* Asset Selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Bookable Asset:
            </span>
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="text-xs bg-background border border-border rounded-lg py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary min-w-[200px]"
            >
              {bookableAssets.length === 0 ? (
                <option value="">No bookable assets</option>
              ) : (
                bookableAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} ({asset.asset_tag})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Week Navigator */}
          <div className="flex items-center gap-3 self-center md:self-auto">
            <div className="flex items-center bg-background border border-border rounded-lg p-0.5 shadow-xs">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={prevWeek}
                className="h-7 w-7"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={setToday}
                className="h-7 text-xs px-2.5 font-semibold"
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={nextWeek}
                className="h-7 w-7"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <span className="text-xs font-bold text-foreground">
              {formatWeekRange()}
            </span>
          </div>
        </div>

        {/* Calendar Grid Sheet */}
        <div className="border border-border rounded-xl bg-card overflow-x-auto shadow-sm">
          <div className="min-w-[800px] grid grid-cols-8 divide-x divide-border">
            {/* Hour labels header column */}
            <div className="col-span-1 bg-muted/5 flex flex-col pt-12 pb-4">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="h-16 flex items-start justify-end pr-3.5 text-[10px] font-bold text-muted-foreground/60 select-none"
                >
                  {hour === 12
                    ? "12 PM"
                    : hour > 12
                    ? `${hour - 12} PM`
                    : `${hour} AM`}
                </div>
              ))}
            </div>

            {/* Week days columns */}
            {weekDays.map((day, dayIndex) => {
              const isToday = new Date().toDateString() === day.toDateString();
              const dayBookings = filteredBookings.filter(
                (b) => new Date(b.start_time).toDateString() === day.toDateString()
              );

              return (
                <div key={dayIndex} className="col-span-1 flex flex-col relative pb-4">
                  {/* Day Header */}
                  <div
                    className={`h-12 border-b border-border flex flex-col items-center justify-center p-2 select-none ${
                      isToday ? "bg-primary/5 text-primary" : "bg-muted/5"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                      {day.toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                    <span
                      className={`text-sm font-extrabold mt-0.5 flex items-center justify-center h-6 w-6 rounded-full ${
                        isToday ? "bg-primary text-primary-foreground font-black" : ""
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>

                  {/* Hour cells slots */}
                  <div className="relative flex-1 min-h-[896px] bg-grid-pattern">
                    {/* Background slots for click-to-book */}
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        onClick={() => handleCellClick(day, hour)}
                        className="h-16 border-b border-border/40 hover:bg-muted/10 cursor-pointer transition-colors"
                        title="Click to create a booking"
                      />
                    ))}

                    {/* Booking Blocks (Absolute Overlay) */}
                    {dayBookings.map((b) => {
                      const startTime = new Date(b.start_time);
                      const endTime = new Date(b.end_time);

                      const startHourDecimal =
                        startTime.getHours() + startTime.getMinutes() / 60;
                      const endHourDecimal =
                        endTime.getHours() + endTime.getMinutes() / 60;

                      // Clamp values within business hours
                      const clampedStart = Math.max(START_HOUR, startHourDecimal);
                      const clampedEnd = Math.min(END_HOUR + 1, endHourDecimal);

                      if (clampedStart >= clampedEnd) return null;

                      // Calculating offsets
                      const topPercent = ((clampedStart - START_HOUR) / HOURS.length) * 100;
                      const heightPercent = ((clampedEnd - clampedStart) / HOURS.length) * 100;

                      const statusClass = getStatusClasses(b.status);

                      return (
                        <Tooltip key={b.id}>
                          <TooltipTrigger
                            render={
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/bookings/${b.id}`);
                                }}
                                style={{
                                  top: `${topPercent}%`,
                                  height: `${heightPercent}%`,
                                }}
                                className={`absolute left-1 right-1 border rounded-lg p-1.5 flex flex-col justify-between overflow-hidden cursor-pointer shadow-xs transition-all select-none text-[10px] ${statusClass}`}
                              />
                            }
                          >
                            <div className="font-semibold truncate">
                              {b.purpose || "Resource Booking"}
                            </div>
                            <div className="flex items-center gap-1 opacity-80 mt-0.5 truncate">
                              <Clock className="h-2.5 w-2.5 shrink-0" />
                              <span>
                                {startTime.toLocaleTimeString([], {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="p-3 max-w-xs space-y-1.5 text-xs">
                            <div className="font-bold flex items-center gap-1 text-primary">
                              <Bookmark className="h-3.5 w-3.5" />
                              {b.purpose || "Resource Booking"}
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <User className="h-3.5 w-3.5 shrink-0" />
                              <span>Booked by: <strong className="text-foreground">{b.booker?.full_name}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              <span>
                                {startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                {" – "}
                                {endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <div className="pt-1.5 border-t border-border/80 flex justify-between items-center text-[10px]">
                              <span>Reference: <code className="font-mono">{b.reference}</code></span>
                              <span className="capitalize font-bold">{b.status}</span>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
