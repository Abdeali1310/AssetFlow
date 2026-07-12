"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Inbox,
  Undo2,
  Send,
  CheckCircle2,
  XCircle,
  Calendar,
  AlertTriangle,
  Wrench,
  ShieldAlert,
  ClipboardCheck,
  FolderClosed,
  Clock,
  Check,
  Filter,
  User,
  CalendarDays,
  ArrowRight,
  Eye,
  Loader2,
} from "lucide-react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  getAllNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getActivityLog,
  getProfiles,
} from "@/lib/actions/notifications";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import type { UserRole } from "@/lib/types";

interface NotificationsClientProps {
  user: {
    id: string;
    full_name: string;
    email: string;
    role: UserRole;
    avatar_url: string | null;
  };
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  asset_assigned: Inbox,
  allocation_returned: Undo2,
  transfer_requested: Send,
  transfer_approved: CheckCircle2,
  transfer_rejected: XCircle,
  booking_confirmed: Calendar,
  booking_cancelled: XCircle,
  booking_reminder: Clock,
  maintenance_approved: Wrench,
  maintenance_rejected: ShieldAlert,
  maintenance_resolved: CheckCircle2,
  overdue_return: AlertTriangle,
  audit_assigned: ClipboardCheck,
  audit_discrepancy_flagged: AlertTriangle,
  audit_cycle_closed: FolderClosed,
};

const typeColors: Record<string, string> = {
  asset_assigned: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
  allocation_returned: "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400",
  transfer_requested: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
  transfer_approved: "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400",
  transfer_rejected: "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive-foreground",
  booking_confirmed: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400",
  booking_cancelled: "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive-foreground",
  booking_reminder: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
  maintenance_approved: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
  maintenance_rejected: "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive-foreground",
  maintenance_resolved: "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400",
  overdue_return: "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive-foreground",
  audit_assigned: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400",
  audit_discrepancy_flagged: "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive-foreground",
  audit_cycle_closed: "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400",
};

function formatAction(action: string): string {
  const mapping: Record<string, string> = {
    "asset.created": "Asset Created",
    "asset.updated": "Asset Updated",
    "asset.allocated": "Asset Allocated",
    "asset.returned": "Asset Returned",
    "asset.transferred": "Asset Transferred",
    "asset.status_changed": "Asset Status Changed",
    "booking.created": "Booking Created",
    "booking.cancelled": "Booking Cancelled",
    "booking.completed": "Booking Completed",
    "maintenance.created": "Maintenance Requested",
    "maintenance.approved": "Maintenance Approved",
    "maintenance.rejected": "Maintenance Rejected",
    "maintenance.resolved": "Maintenance Resolved",
    "audit.created": "Audit Cycle Started",
    "audit.item_submitted": "Audit Item Verified",
    "audit.closed": "Audit Cycle Closed",
  };
  return mapping[action] ?? action.replace(/_/g, " ").replace(/\./g, " - ");
}

function getEntityLink(relatedType: string | null, relatedId: string | null) {
  if (!relatedType || !relatedId) return null;
  switch (relatedType) {
    case "asset":
      return `/assets/${relatedId}`;
    case "booking":
      return `/bookings/${relatedId}`;
    case "maintenance":
    case "maintenance_request":
      return `/maintenance/${relatedId}`;
    case "audit":
    case "audit_cycle":
      return `/audits/${relatedId}`;
    case "allocation":
    case "transfer":
      return `/allocations`;
    default:
      return null;
  }
}

function renderDetails(details: any) {
  if (!details) return "-";
  if (typeof details === "string") return details;
  const parts = [];
  if (details.name) parts.push(`Name: ${details.name}`);
  if (details.asset_tag) parts.push(`Tag: ${details.asset_tag}`);
  if (details.reason) parts.push(`Reason: ${details.reason}`);
  if (details.status) parts.push(`Status: ${details.status}`);
  if (details.notes) parts.push(`Notes: ${details.notes}`);
  if (details.priority) parts.push(`Priority: ${details.priority}`);
  
  if (parts.length > 0) return parts.join(", ");
  return Object.entries(details)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(", ");
}

export function NotificationsClient({ user }: NotificationsClientProps) {
  const router = useRouter();

  // Tab state
  const [activeTab, setActiveTab] = useState("notifications");

  // Notifications states
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifFilterRead, setNotifFilterRead] = useState<string>("all");
  const [notifFilterType, setNotifFilterType] = useState<string>("all");
  const [notifLoading, setNotifLoading] = useState(true);

  // Activity Log states
  const [logs, setLogs] = useState<any[]>([]);
  const [profilesList, setProfilesList] = useState<any[]>([]);
  const [logFilterEntity, setLogFilterEntity] = useState<string>("all");
  const [logFilterActor, setLogFilterActor] = useState<string>("all");
  const [logFilterDateFrom, setLogFilterDateFrom] = useState("");
  const [logFilterDateTo, setLogFilterDateTo] = useState("");
  const [logLoading, setLogLoading] = useState(true);

  // Pagination states
  const [notifPage, setNotifPage] = useState(1);
  const [logPage, setLogPage] = useState(1);
  const itemsPerPage = 10;

  const showActorFilter = user.role === "admin" || user.role === "asset_manager";

  // Fetch Notifications
  const fetchNotifs = async () => {
    setNotifLoading(true);
    const readVal =
      notifFilterRead === "read"
        ? true
        : notifFilterRead === "unread"
        ? false
        : undefined;

    const res = await getAllNotifications(user.id, {
      type: notifFilterType,
      isRead: readVal,
    });
    if (res.data) {
      setNotifications(res.data);
    } else {
      toast.error(res.error || "Failed to load notifications");
    }
    setNotifLoading(false);
  };

  // Fetch Activity Logs
  const fetchLogs = async () => {
    setLogLoading(true);
    const filters: any = {};
    if (logFilterEntity && logFilterEntity !== "all") {
      filters.entityType = logFilterEntity;
    }
    if (logFilterActor && logFilterActor !== "all" && showActorFilter) {
      filters.actorId = logFilterActor;
    }
    if (logFilterDateFrom) {
      filters.dateFrom = new Date(logFilterDateFrom).toISOString();
    }
    if (logFilterDateTo) {
      // End of day to be inclusive
      const end = new Date(logFilterDateTo);
      end.setHours(23, 59, 59, 999);
      filters.dateTo = end.toISOString();
    }

    const res = await getActivityLog(filters);
    if (res.data) {
      setLogs(res.data);
    } else {
      toast.error(res.error || "Failed to load activity log");
    }
    setLogLoading(false);
  };

  // Load profiles for actor filter
  useEffect(() => {
    if (showActorFilter) {
      getProfiles().then((res) => {
        if (res.data) {
          setProfilesList(res.data);
        }
      });
    }
  }, [showActorFilter]);

  // Effect for active tab changes / filters
  useEffect(() => {
    if (activeTab === "notifications") {
      fetchNotifs();
    } else {
      fetchLogs();
    }
  }, [
    activeTab,
    notifFilterRead,
    notifFilterType,
    logFilterEntity,
    logFilterActor,
    logFilterDateFrom,
    logFilterDateTo,
  ]);

  // Actions
  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    const res = await markNotificationRead(id);
    if (res.error) {
      toast.error(res.error);
      fetchNotifs();
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const res = await markAllNotificationsRead(user.id);
    if (res.error) {
      toast.error(res.error);
      fetchNotifs();
    } else {
      toast.success("All notifications marked as read");
    }
  };

  const handleNotifClick = async (n: any) => {
    if (!n.is_read) {
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
      );
      await markNotificationRead(n.id);
    }
    const link = getEntityLink(n.related_type, n.related_id);
    if (link) {
      router.push(link);
    }
  };

  // Paginated data helpers
  const paginatedNotifs = notifications.slice(
    (notifPage - 1) * itemsPerPage,
    notifPage * itemsPerPage
  );
  const totalNotifPages = Math.ceil(notifications.length / itemsPerPage);

  const paginatedLogs = logs.slice(
    (logPage - 1) * itemsPerPage,
    logPage * itemsPerPage
  );
  const totalLogPages = Math.ceil(logs.length / itemsPerPage);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">Notifications & Activity Log</h1>
        <p className="text-xs text-muted-foreground">
          Track system notifications, allocation updates, and audit records.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setNotifPage(1); setLogPage(1); }} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="notifications" className="text-xs font-semibold px-4 cursor-pointer">
            Notifications
            {notifications.filter((n) => !n.is_read).length > 0 && (
              <Badge className="ml-2 bg-destructive text-destructive-foreground hover:bg-destructive text-[10px] px-1.5 py-0">
                {notifications.filter((n) => !n.is_read).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-xs font-semibold px-4 cursor-pointer">
            Activity Log
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Notifications */}
        <TabsContent value="notifications" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-4 rounded-xl">
            <div className="flex flex-wrap items-center gap-3">
              {/* Read Filter */}
              <div className="w-36">
                <Select value={notifFilterRead} onValueChange={(v) => { if (v) { setNotifFilterRead(v); setNotifPage(1); } }}>
                  <SelectTrigger className="h-8 text-xs cursor-pointer">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs cursor-pointer">All Statuses</SelectItem>
                    <SelectItem value="unread" className="text-xs cursor-pointer">Unread</SelectItem>
                    <SelectItem value="read" className="text-xs cursor-pointer">Read</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Type Filter */}
              <div className="w-48">
                <Select value={notifFilterType} onValueChange={(v) => { if (v) { setNotifFilterType(v); setNotifPage(1); } }}>
                  <SelectTrigger className="h-8 text-xs cursor-pointer">
                    <SelectValue placeholder="Notification Type" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all" className="text-xs cursor-pointer">All Types</SelectItem>
                    <SelectItem value="asset_assigned" className="text-xs cursor-pointer">Asset Assigned</SelectItem>
                    <SelectItem value="allocation_returned" className="text-xs cursor-pointer">Allocation Returned</SelectItem>
                    <SelectItem value="transfer_requested" className="text-xs cursor-pointer">Transfer Requested</SelectItem>
                    <SelectItem value="transfer_approved" className="text-xs cursor-pointer">Transfer Approved</SelectItem>
                    <SelectItem value="booking_confirmed" className="text-xs cursor-pointer">Booking Confirmed</SelectItem>
                    <SelectItem value="maintenance_resolved" className="text-xs cursor-pointer">Maintenance Resolved</SelectItem>
                    <SelectItem value="overdue_return" className="text-xs cursor-pointer">Overdue Return</SelectItem>
                    <SelectItem value="audit_assigned" className="text-xs cursor-pointer">Audit Assigned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {notifications.some((n) => !n.is_read) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllRead}
                className="text-xs h-8 cursor-pointer"
              >
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Mark all as read
              </Button>
            )}
          </div>

          {notifLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-card border border-border rounded-xl">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <span className="text-xs font-semibold">Loading notifications...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border border-dashed rounded-xl">
              <div className="rounded-full bg-muted p-4 mb-3">
                <Bell className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-bold text-foreground">No notifications found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                You're all caught up! There are no notifications matching your filters.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                {paginatedNotifs.map((n) => {
                  const Icon = typeIcons[n.type] || Bell;
                  const colorClass = typeColors[n.type] || "bg-muted text-muted-foreground";
                  const detailLink = getEntityLink(n.related_type, n.related_id);


                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className={`flex items-start justify-between p-4 transition-colors cursor-pointer hover:bg-muted/30 ${
                        !n.is_read ? "bg-muted/10" : ""
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`h-9 w-9 shrink-0 flex items-center justify-center rounded-lg mt-0.5 ${colorClass}`}>
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-foreground">{n.title}</span>
                            {!n.is_read && (
                              <Badge className="bg-blue-500/10 text-blue-600 border-none font-bold text-[9px] py-0 px-1.5">
                                New
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-normal max-w-2xl">
                            {n.message}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        {detailLink && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(detailLink);
                            }}
                            title="View details"
                            className="cursor-pointer"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                        {!n.is_read && (
                          <Button
                            variant="outline"
                            size="icon-xs"
                            onClick={(e) => handleMarkRead(n.id, e)}
                            title="Mark as read"
                            className="cursor-pointer text-green-600 hover:text-green-700 hover:bg-green-500/10 border-green-200/50 hover:border-green-300"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalNotifPages > 1 && (
                <div className="flex items-center justify-between py-2 text-xs">
                  <span className="text-muted-foreground">
                    Page {notifPage} of {totalNotifPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={notifPage === 1}
                      onClick={() => setNotifPage((p) => p - 1)}
                      className="cursor-pointer"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={notifPage === totalNotifPages}
                      onClick={() => setNotifPage((p) => p + 1)}
                      className="cursor-pointer"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Activity Log */}
        <TabsContent value="logs" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-card border border-border p-4 rounded-xl">
            {/* Entity Type Filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Entity Type</label>
              <Select value={logFilterEntity} onValueChange={(v) => { if (v) { setLogFilterEntity(v); setLogPage(1); } }}>
                <SelectTrigger className="h-8 text-xs cursor-pointer">
                  <SelectValue placeholder="Entity Type" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all" className="text-xs cursor-pointer">All Entities</SelectItem>
                  <SelectItem value="asset" className="text-xs cursor-pointer">Asset</SelectItem>
                  <SelectItem value="allocation" className="text-xs cursor-pointer">Allocation</SelectItem>
                  <SelectItem value="transfer" className="text-xs cursor-pointer">Transfer</SelectItem>
                  <SelectItem value="booking" className="text-xs cursor-pointer">Booking</SelectItem>
                  <SelectItem value="maintenance_request" className="text-xs cursor-pointer">Maintenance</SelectItem>
                  <SelectItem value="audit_cycle" className="text-xs cursor-pointer">Audit Cycle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actor Filter (Admin/Manager only) */}
            {showActorFilter ? (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Performed By</label>
                <Select value={logFilterActor} onValueChange={(v) => { if (v) { setLogFilterActor(v); setLogPage(1); } }}>
                  <SelectTrigger className="h-8 text-xs cursor-pointer">
                    <SelectValue placeholder="Actor" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all" className="text-xs cursor-pointer">All Users</SelectItem>
                    {profilesList.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs cursor-pointer">
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="hidden sm:block" />
            )}

            {/* Date From */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Date From</label>
              <div className="relative">
                <CalendarDays className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={logFilterDateFrom}
                  onChange={(e) => { setLogFilterDateFrom(e.target.value); setLogPage(1); }}
                  className="h-8 pl-8 text-xs cursor-pointer"
                />
              </div>
            </div>

            {/* Date To */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Date To</label>
              <div className="relative">
                <CalendarDays className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={logFilterDateTo}
                  onChange={(e) => { setLogFilterDateTo(e.target.value); setLogPage(1); }}
                  className="h-8 pl-8 text-xs cursor-pointer"
                />
              </div>
            </div>
          </div>

          {logLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-card border border-border rounded-xl">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <span className="text-xs font-semibold">Loading activity logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border border-dashed rounded-xl">
              <div className="rounded-full bg-muted p-4 mb-3">
                <Clock className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-bold text-foreground">No activities found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                No activity logs matched your current filters or date range.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold text-muted-foreground py-3">Actor</TableHead>
                      <TableHead className="font-semibold text-muted-foreground py-3">Action</TableHead>
                      <TableHead className="font-semibold text-muted-foreground py-3">Entity</TableHead>
                      <TableHead className="font-semibold text-muted-foreground py-3">Details Summary</TableHead>
                      <TableHead className="font-semibold text-muted-foreground py-3 text-right">Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border">
                    {paginatedLogs.map((log) => {
                      const link = getEntityLink(log.entity_type, log.entity_id);
                      return (
                        <TableRow key={log.id} className="hover:bg-muted/10">
                          <td className="py-3.5">
                            <span className="font-semibold block">{log.actor?.full_name || "System"}</span>
                            <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[150px] block">
                              {log.actor?.email || ""}
                            </span>
                          </td>
                          <td className="py-3.5 font-medium text-foreground">
                            {formatAction(log.action)}
                          </td>
                          <td className="py-3.5">
                            {link ? (
                              <Link
                                href={link}
                                className="text-primary hover:underline font-semibold flex items-center gap-1"
                              >
                                {log.entity_type}
                                <Eye className="h-3 w-3" />
                              </Link>
                            ) : (
                              <span className="text-muted-foreground capitalize">{log.entity_type}</span>
                            )}
                          </td>
                          <td className="py-3.5 text-muted-foreground leading-relaxed max-w-xs truncate" title={renderDetails(log.details)}>
                            {renderDetails(log.details)}
                          </td>
                          <td className="py-3.5 text-right font-mono text-muted-foreground">
                            {format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")}
                          </td>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalLogPages > 1 && (
                <div className="flex items-center justify-between py-2 text-xs">
                  <span className="text-muted-foreground">
                    Page {logPage} of {totalLogPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={logPage === 1}
                      onClick={() => setLogPage((p) => p - 1)}
                      className="cursor-pointer"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={logPage === totalLogPages}
                      onClick={() => setLogPage((p) => p + 1)}
                      className="cursor-pointer"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
