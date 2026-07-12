"use client";

import React, { useState, useEffect } from "react";
import {
  UserCheck,
  ArrowRightLeft,
  Wrench,
  Calendar,
  History,
  Clock,
} from "lucide-react";

interface TimelineEvent {
  id: string;
  type: string;
  date: string;
  title: string;
  description: string;
  actor: string;
}

interface AssetHistoryTimelineProps {
  timeline: TimelineEvent[];
}

function TimelineDate({ dateString }: { dateString: string }) {
  const [formatted, setFormatted] = useState("");

  useEffect(() => {
    try {
      const date = new Date(dateString);
      setFormatted(
        date.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch (e) {
      setFormatted(dateString);
    }
  }, [dateString]);

  // Render a placeholder empty space or basic indicator on server to avoid hydration mismatch
  return (
    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
      <Clock className="h-3 w-3" />
      {formatted || "Loading..."}
    </span>
  );
}

export function AssetHistoryTimeline({ timeline }: AssetHistoryTimelineProps) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed rounded-lg bg-muted/10 text-center">
        <History className="h-8 w-8 text-muted-foreground/60 mb-2.5" />
        <h4 className="text-sm font-semibold text-foreground">No History Recorded</h4>
        <p className="text-xs text-muted-foreground max-w-[280px] mt-1">
          This asset is brand new and has not undergone any allocations, maintenance requests, or bookings yet.
        </p>
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "allocation":
        return <UserCheck className="h-4 w-4 text-primary" />;
      case "transfer":
        return <ArrowRightLeft className="h-4 w-4 text-warning" />;
      case "maintenance":
        return <Wrench className="h-4 w-4 text-destructive" />;
      case "booking":
        return <Calendar className="h-4 w-4 text-info" />;
      default:
        return <History className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getColorClass = (type: string) => {
    switch (type) {
      case "allocation":
        return "bg-primary/10 border-primary/20";
      case "transfer":
        return "bg-warning/10 border-warning/20";
      case "maintenance":
        return "bg-destructive/10 border-destructive/20";
      case "booking":
        return "bg-info/10 border-info/20";
      default:
        return "bg-muted border-border";
    }
  };

  return (
    <div className="relative border-l border-border pl-6 ml-3 space-y-6 py-2">
      {timeline.map((event) => (
        <div key={event.id} className="relative group">
          {/* Bullet Circle marker */}
          <div
            className={`absolute -left-[35px] top-0.5 flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition-all duration-200 group-hover:scale-110 ${getColorClass(
              event.type
            )}`}
          >
            {getIcon(event.type)}
          </div>

          {/* Timeline Content */}
          <div className="bg-card hover:bg-muted/10 border border-border/80 hover:border-border rounded-lg p-4 shadow-sm transition-all duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 mb-1.5">
              <span className="font-semibold text-sm text-foreground">
                {event.title}
              </span>
              <TimelineDate dateString={event.date} />
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {event.description}
            </p>

            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-foreground/80 font-medium">
              <span className="text-muted-foreground">Actor:</span>
              <span className="bg-muted px-1.5 py-0.5 rounded text-foreground">
                {event.actor}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
