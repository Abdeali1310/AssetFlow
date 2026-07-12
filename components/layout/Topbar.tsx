"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Search, LogOut, UserCircle } from "lucide-react";
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
import type { UserRole } from "@/lib/types";

interface TopbarProps {
  user: {
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getPageTitle(pathname: string): string {
  // Exact match first
  if (routeTitles[pathname]) return routeTitles[pathname];

  // Find the closest matching prefix
  const match = Object.keys(routeTitles)
    .filter((route) => pathname.startsWith(route))
    .sort((a, b) => b.length - a.length)[0];

  return match ? routeTitles[match] : "Dashboard";
}

export function Topbar({ user, unreadCount = 0 }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const pageTitle = getPageTitle(pathname);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

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

        {/* Notifications */}
        <Link href="/notifications">
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>
        </Link>

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
