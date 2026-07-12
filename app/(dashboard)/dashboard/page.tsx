import { createClient } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/actions/dashboard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RealtimeRefresher } from "@/components/dashboard/RealtimeRefresher";
import {
  Boxes,
  PackageCheck,
  Wrench,
  CalendarClock,
  ArrowRightLeft,
  CalendarCheck,
  PlusCircle,
  FileSpreadsheet,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  canRegisterAssets,
} from "@/lib/permissions";
import type { UserRole } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get user profile data
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, department_id, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return null;
  }

  const role = profile.role as UserRole;
  const departmentId = profile.department_id;

  const stats = await getDashboardStats(user.id, role, departmentId);

  return (
    <div className="space-y-8">
      <RealtimeRefresher />

      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back, {profile.full_name}
          </h2>
          <p className="text-sm text-muted-foreground">
            Here is a status update for your enterprise resources.
          </p>
        </div>
      </div>

      {/* Row 1: KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="Assets Available"
          value={stats.assetsAvailable}
          icon={Boxes}
          colorVariant="success"
          href="/assets?status=available"
          index={0}
        />
        <KpiCard
          title="Assets Allocated"
          value={stats.assetsAllocated}
          icon={PackageCheck}
          colorVariant="primary"
          href="/assets?status=allocated"
          index={1}
        />
        <KpiCard
          title="Maintenance Active"
          value={stats.maintenanceActive}
          icon={Wrench}
          colorVariant="warning"
          href="/maintenance"
          index={2}
        />
        <KpiCard
          title="Active Bookings"
          value={stats.activeBookings}
          icon={CalendarClock}
          colorVariant="primary"
          href="/bookings"
          index={3}
        />
        <KpiCard
          title="Pending Transfers"
          value={stats.pendingTransfers}
          icon={ArrowRightLeft}
          colorVariant="warning"
          href="/allocations?tab=transfers"
          index={4}
        />
        <KpiCard
          title="Upcoming Returns"
          value={stats.upcomingReturns}
          icon={CalendarCheck}
          colorVariant="muted"
          href="/allocations?tab=active"
          index={5}
        />
      </div>

      {/* Row 2: Overdue Returns */}
      {stats.overdueAllocations.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-lg font-semibold text-destructive">
                  Overdue Returns
                </CardTitle>
                <Badge variant="destructive" className="rounded-full px-2 py-0">
                  {stats.overdueAllocations.length}
                </Badge>
              </div>
              <CardDescription className="text-muted-foreground/80">
                These assets have exceeded their expected return date. Please take action immediately.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-md border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Held By</TableHead>
                    <TableHead>Expected Return</TableHead>
                    <TableHead className="text-right">Overdue By</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.overdueAllocations.map((item) => (
                    <TableRow key={item.allocation_id}>
                      <TableCell className="font-medium">
                        <div>
                          <p>{item.asset_name}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {item.asset_tag}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{item.employee_name || "Department"}</TableCell>
                      <TableCell>
                        {new Date(item.expected_return_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-destructive">
                        {item.days_overdue} {item.days_overdue === 1 ? "day" : "days"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/allocations?id=${item.allocation_id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Row 3: Quick Actions */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Actions
        </h3>
        <div className="flex flex-wrap gap-3">
          {canRegisterAssets(role) && (
            <Link href="/assets/new">
              <Button className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                Register Asset
              </Button>
            </Link>
          )}
          <Link href="/bookings/new">
            <Button variant="outline" className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Book Resource
            </Button>
          </Link>
          <Link href="/maintenance/new">
            <Button variant="outline" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Raise Maintenance Request
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
