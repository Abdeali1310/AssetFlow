"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  XCircle,
  MapPin,
  Clock,
  User,
  FileWarning,
} from "lucide-react";

interface DiscrepancyReportProps {
  items: any[];
}

export function DiscrepancyReport({ items }: DiscrepancyReportProps) {
  // Filter only missing and damaged items
  const discrepancies = items.filter(
    (i) => i.result === "missing" || i.result === "damaged"
  );

  const missingItems = discrepancies.filter((i) => i.result === "missing");
  const damagedItems = discrepancies.filter((i) => i.result === "damaged");

  if (discrepancies.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="border-b border-border p-4 bg-muted/10">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <FileWarning className="h-4 w-4 text-amber-500" />
            Discrepancy Report
          </h3>
        </div>
        <div className="p-8 text-center text-muted-foreground text-xs">
          <FileWarning className="h-6 w-6 mx-auto mb-2 opacity-30" />
          <p className="font-semibold">No discrepancies found</p>
          <p className="text-[10px] mt-0.5">
            All audited assets are accounted for. This report updates live as
            items are marked.
          </p>
        </div>
      </div>
    );
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const renderGroup = (
    title: string,
    icon: React.ReactNode,
    groupItems: any[],
    colorClass: string,
    borderClass: string
  ) => {
    if (groupItems.length === 0) return null;

    return (
      <div className="space-y-0">
        {/* Group Header */}
        <div
          className={`px-4 py-2.5 ${colorClass} flex items-center justify-between`}
        >
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
            {icon}
            {title}
          </span>
          <Badge
            className={`${borderClass} text-[9px] font-bold py-0 px-1.5`}
          >
            {groupItems.length}
          </Badge>
        </div>

        {/* Group Items */}
        <div className="divide-y divide-border/50">
          {groupItems.map((item) => (
            <div
              key={item.id}
              className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2"
            >
              {/* Asset Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                  {item.asset?.name || "Unknown Asset"}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <span className="font-mono">
                    {item.asset?.asset_tag || "—"}
                  </span>
                  {item.asset?.location && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-2.5 w-2.5" />
                      {item.asset.location}
                    </span>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="flex-1 min-w-0">
                {item.notes ? (
                  <p className="text-[10px] text-foreground italic leading-relaxed line-clamp-2">
                    &ldquo;{item.notes}&rdquo;
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground italic">
                    No notes provided
                  </p>
                )}
              </div>

              {/* Auditor + Timestamp */}
              <div className="flex items-center gap-3 shrink-0 text-[10px] text-muted-foreground">
                {item.auditor?.full_name && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {item.auditor.full_name}
                  </span>
                )}
                {item.audited_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDateTime(item.audited_at)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
      {/* Header */}
      <div className="border-b border-border p-4 bg-muted/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <FileWarning className="h-4 w-4 text-amber-500" />
              Discrepancy Report
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Auto-generated from audit results. Updates live as items are
              marked.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {missingItems.length > 0 && (
              <Badge className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/10 text-[9px] font-bold py-0 px-1.5">
                {missingItems.length} Missing
              </Badge>
            )}
            {damagedItems.length > 0 && (
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/10 text-[9px] font-bold py-0 px-1.5">
                {damagedItems.length} Damaged
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Groups */}
      {renderGroup(
        "Missing Assets",
        <XCircle className="h-3.5 w-3.5 text-red-500" />,
        missingItems,
        "bg-red-500/[0.03]",
        "bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/10"
      )}
      {renderGroup(
        "Damaged Assets",
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
        damagedItems,
        "bg-amber-500/[0.03]",
        "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/10"
      )}
    </div>
  );
}
