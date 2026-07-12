import React from "react";
import {
  CheckCircle2,
  UserCheck,
  CalendarClock,
  Wrench,
  AlertTriangle,
  Archive,
  Trash2,
} from "lucide-react";
import { AssetStatus } from "@/lib/types";

interface AssetStatusBadgeProps {
  status: AssetStatus;
}

const statusConfig: Record<
  AssetStatus,
  {
    label: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  available: {
    label: "Available",
    bgClass: "bg-success/10",
    textClass: "text-success",
    borderClass: "border-success/30",
    icon: CheckCircle2,
  },
  allocated: {
    label: "Allocated",
    bgClass: "bg-primary/10",
    textClass: "text-primary",
    borderClass: "border-primary/30",
    icon: UserCheck,
  },
  reserved: {
    label: "Reserved",
    bgClass: "bg-warning/10",
    textClass: "text-warning",
    borderClass: "border-warning/30",
    icon: CalendarClock,
  },
  under_maintenance: {
    label: "In Maintenance",
    bgClass: "bg-warning/10",
    textClass: "text-warning",
    borderClass: "border-warning/30",
    icon: Wrench,
  },
  lost: {
    label: "Lost",
    bgClass: "bg-destructive/10",
    textClass: "text-destructive",
    borderClass: "border-destructive/30",
    icon: AlertTriangle,
  },
  retired: {
    label: "Retired",
    bgClass: "bg-muted text-muted-foreground",
    textClass: "text-muted-foreground",
    borderClass: "border-muted-foreground/20",
    icon: Archive,
  },
  disposed: {
    label: "Disposed",
    bgClass: "bg-muted text-muted-foreground",
    textClass: "text-muted-foreground",
    borderClass: "border-muted-foreground/20",
    icon: Trash2,
  },
};

export function AssetStatusBadge({ status }: AssetStatusBadgeProps) {
  const config = statusConfig[status] || {
    label: String(status),
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    borderClass: "border-muted-foreground/20",
    icon: CheckCircle2,
  };

  const IconComponent = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${config.bgClass} ${config.textClass} ${config.borderClass}`}
    >
      <IconComponent className="h-3.5 w-3.5 shrink-0" />
      {config.label}
    </span>
  );
}
