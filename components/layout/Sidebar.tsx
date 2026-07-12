"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  LayoutDashboard,
  ArrowRightLeft,
  CalendarClock,
  Wrench,
  ClipboardCheck,
  BarChart3,
  Bell,
  Settings2,
  UserCircle,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canViewAudits, canViewOrgWideReports, canManageOrgSetup } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";

interface SidebarProps {
  user: {
    id: string;
    full_name: string;
    email: string;
    role: UserRole;
    avatar_url: string | null;
  };
  unreadCount?: number;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: boolean;
  badge?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: "Administrator",
    asset_manager: "Asset Manager",
    department_head: "Dept. Head",
    employee: "Employee",
  };
  return labels[role] ?? role;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Sidebar({ user, unreadCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const navGroups: NavGroup[] = [
    {
      title: "OVERVIEW",
      items: [
        {
          label: "Dashboard",
          href: "/dashboard",
          icon: LayoutDashboard,
          visible: true,
        },
      ],
    },
    {
      title: "OPERATIONS",
      items: [
        {
          label: "Assets",
          href: "/assets",
          icon: Boxes,
          visible: true,
        },
        {
          label: "Allocations & Transfers",
          href: "/allocations",
          icon: ArrowRightLeft,
          visible: true,
        },
        {
          label: "Resource Bookings",
          href: "/bookings",
          icon: CalendarClock,
          visible: true,
        },
        {
          label: "Maintenance",
          href: "/maintenance",
          icon: Wrench,
          visible: true,
        },
        {
          label: "Audits",
          href: "/audits",
          icon: ClipboardCheck,
          visible: canViewAudits(user.role),
        },
      ],
    },
    {
      title: "INSIGHTS",
      items: [
        {
          label: "Reports",
          href: "/reports",
          icon: BarChart3,
          visible: canViewOrgWideReports(user.role),
        },
        {
          label: "Notifications",
          href: "/notifications",
          icon: Bell,
          visible: true,
          badge: unreadCount,
        },
      ],
    },
    {
      title: "CONFIGURATION",
      items: [
        {
          label: "Organization Setup",
          href: "/org-setup",
          icon: Settings2,
          visible: canManageOrgSetup(user.role),
        },
        {
          label: "Profile",
          href: "/profile",
          icon: UserCircle,
          visible: true,
        },
      ],
    },
  ];

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-[260px] flex-col border-r border-border bg-card">
      {/* Wordmark */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <Boxes className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold tracking-tight text-foreground">
          AssetFlow
        </span>
        <Badge
          variant="secondary"
          className="ml-1 rounded-sm px-1.5 py-0 text-[10px] font-medium uppercase tracking-wider"
        >
          ERP
        </Badge>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => item.visible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title}>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "border-l-2 border-primary bg-primary/5 text-primary"
                            : "border-l-2 border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                          )}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && item.badge > 0 ? (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-medium text-destructive-foreground">
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.full_name}
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {getInitials(user.full_name)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {user.full_name}
            </p>
            <p className="text-xs text-muted-foreground">
              {getRoleLabel(user.role)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
