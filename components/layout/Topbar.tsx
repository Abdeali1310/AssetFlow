"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Search,
  LogOut,
  UserCircle,
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
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  getRecentNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/actions/notifications";
import { formatDistanceToNow } from "date-fns";
import type { UserRole } from "@/lib/types";

interface TopbarProps {
  user: {
    id: string;
    full_name: string;
    email: string;
    role: UserRole;
    avatar_url: string | null;
  };
  unreadCount?: number;
}

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/assets": "Assets",
  "/allocations": "Allocations & Transfers",
  "/bookings": "Resource Bookings",
  "/maintenance": "Maintenance",
  "/audits": "Audits",
  "/reports": "Reports",
  "/notifications": "Notifications",
  "/org-setup": "Organization Setup",
  "/profile": "Profile",
};

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
  overdue_return: "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive-foreground animate-pulse",
  audit_assigned: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400",
  audit_discrepancy_flagged: "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive-foreground",
  audit_cycle_closed: "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getPageTitle(pathname: string): string {
  if (routeTitles[pathname]) return routeTitles[pathname];
  const match = Object.keys(routeTitles)
    .filter((route) => pathname.startsWith(route))
    .sort((a, b) => b.length - a.length)[0];
  return match ? routeTitles[match] : "Dashboard";
}

function getNotificationLink(relatedType: string, relatedId: string) {
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
      return "/dashboard";
  }
}

export function Topbar({ user, unreadCount: initialUnreadCount = 0 }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const pageTitle = getPageTitle(pathname);

  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    const [count, recent] = await Promise.all([
      getUnreadNotificationCount(user.id),
      getRecentNotifications(user.id, 5),
    ]);
    setUnreadCount(count);
    if (recent.data) {
      setNotifications(recent.data);
    }
    setLoading(false);
  };

  // Fetch count and recent notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, [user.id]);

  // Subscribe to Supabase Realtime for notifications
  useEffect(() => {
    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const handleMarkAllRead = async () => {
    // Optimistic UI update
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await markAllNotificationsRead(user.id);
  };

  const handleNotificationClick = async (n: any) => {
    setPopoverOpen(false);
    if (!n.is_read) {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      await markNotificationRead(n.id);
    }
    if (n.related_type && n.related_id) {
      router.push(getNotificationLink(n.related_type, n.related_id));
    }
  };

  return (
    <header className="fixed top-0 left-[260px] right-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card px-6">
      {/* Left: Page title */}
      <div>
        <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
      </div>

      {/* Right: Search, notifications, user menu */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search... (Cmd+K)"
            className="h-9 w-64 pl-9 text-sm"
            readOnly
          />
        </div>

        {/* Notifications Popover */}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger
            className="relative h-9 w-9 text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center rounded-md hover:bg-accent transition-colors"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 shadow-lg border border-border" align="end">

            <div className="flex items-center justify-between border-b border-border p-3">
              <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary hover:text-primary/80 font-medium h-7 px-2"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>

            <div className="max-h-[350px] overflow-y-auto divide-y divide-border">
              {loading && notifications.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <div className="rounded-full bg-muted p-3 mb-2">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-xs font-medium text-foreground">All caught up!</p>
                  <p className="text-[10px] text-muted-foreground">No new notifications here.</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const Icon = typeIcons[n.type] || Bell;
                  const colorClass = typeColors[n.type] || "bg-muted text-muted-foreground";
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`flex gap-3 p-3 text-left transition-colors cursor-pointer hover:bg-muted/50 ${
                        !n.is_read ? "bg-muted/10 font-medium" : ""
                      }`}
                    >
                      <div className={`h-8 w-8 shrink-0 flex items-center justify-center rounded-lg ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 space-y-0.5 overflow-hidden">
                        <p className="text-xs text-foreground truncate">{n.title}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                          {n.message}
                        </p>
                        <p className="text-[9px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {!n.is_read && (
                        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 self-center" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-border p-2 text-center bg-muted/20">
              <Link
                href="/notifications"
                onClick={() => setPopoverOpen(false)}
                className="text-xs text-primary hover:text-primary/80 font-medium block w-full py-1.5"
              >
                View all notifications
              </Link>
            </div>
          </PopoverContent>
        </Popover>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-9 items-center gap-2 rounded-md px-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {getInitials(user.full_name)}
              </div>
            )}
            <span className="hidden text-sm font-medium lg:inline-block">
              {user.full_name}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => router.push("/profile")}
              className="flex items-center gap-2"
            >
              <UserCircle className="h-4 w-4" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
