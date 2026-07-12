"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Wrench,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

interface MaintenanceClientProps {
  initialRequests: any[];
}

export function MaintenanceClient({ initialRequests }: MaintenanceClientProps) {
  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Format date helper
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Get priority badge style
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "low":
        return (
          <Badge className="bg-muted text-muted-foreground border-muted-foreground/10 hover:bg-muted text-[10px] font-bold py-0 px-2 uppercase tracking-wider">
            Low
          </Badge>
        );
      case "high":
        return (
          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 hover:bg-orange-500/10 text-[10px] font-bold py-0 px-2 uppercase tracking-wider">
            High
          </Badge>
        );
      case "critical":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/10 text-[10px] font-black py-0 px-2 uppercase tracking-wider animate-pulse flex items-center gap-1 w-fit">
            <AlertOctagon className="h-2.5 w-2.5" /> Critical
          </Badge>
        );
      case "medium":
      default:
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10 text-[10px] font-bold py-0 px-2 uppercase tracking-wider">
            Medium
          </Badge>
        );
    }
  };

  // Get status badge style
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/10 text-[10px] py-0 px-2 font-semibold flex items-center gap-1 w-fit">
            <Clock className="h-3 w-3" /> Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10 text-[10px] py-0 px-2 font-semibold flex items-center gap-1 w-fit">
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/10 text-[10px] py-0 px-2 font-semibold flex items-center gap-1 w-fit">
            <XCircle className="h-3 w-3" /> Rejected
          </Badge>
        );
      case "technician_assigned":
        return (
          <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 hover:bg-purple-500/10 text-[10px] py-0 px-2 font-semibold flex items-center gap-1 w-fit">
            Assigned
          </Badge>
        );
      case "in_progress":
        return (
          <Badge className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 hover:bg-indigo-500/10 text-[10px] py-0 px-2 font-semibold flex items-center gap-1 w-fit">
            In Progress
          </Badge>
        );
      case "resolved":
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/10 text-[10px] py-0 px-2 font-semibold flex items-center gap-1 w-fit">
            <CheckCircle2 className="h-3 w-3" /> Resolved
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] py-0 px-2 capitalize">
            {status}
          </Badge>
        );
    }
  };

  // Filter requests
  const filteredRequests = initialRequests.filter((req) => {
    const assetName = req.asset?.name || "";
    const assetTag = req.asset?.asset_tag || "";
    const ref = req.reference || "";
    const reporterName = req.reporter?.full_name || "";

    const matchesSearch =
      `${assetName} ${assetTag} ${ref} ${reporterName}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || req.status === statusFilter;

    const matchesPriority =
      priorityFilter === "all" || req.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Calculate active maintenance counts (pending + assigned + in_progress)
  const activeCount = initialRequests.filter((r) =>
    ["pending", "approved", "technician_assigned", "in_progress"].includes(r.status)
  ).length;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wrench className="h-6 w-6 text-primary" />
            Maintenance Management
            <Badge variant="secondary" className="ml-1 text-[11px] px-2 py-0.5">
              {activeCount} Active
            </Badge>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Track reported equipment defects, schedule technician inspections, and manage resolving progress workflows.
          </p>
        </div>

        <Link href="/maintenance/new" className="w-full sm:w-auto">
          <Button size="sm" className="w-full">
            <Plus className="mr-1.5 h-4 w-4" />
            Raise Request
          </Button>
        </Link>
      </div>

      {/* Outer filter layout */}
      <div className="space-y-4">
        {/* Status filters */}
        <div className="flex flex-wrap bg-muted/30 p-1 rounded-lg border border-border/60 text-xs self-start gap-1 w-fit">
          {[
            { value: "all", label: "All Requests" },
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "technician_assigned", label: "Assigned" },
            { value: "in_progress", label: "In Progress" },
            { value: "resolved", label: "Resolved" },
            { value: "rejected", label: "Rejected" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1 rounded-md transition-colors ${
                statusFilter === tab.value
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search + Priority filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by asset name, tag, or reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs bg-background border border-border rounded-lg py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary min-w-[130px]"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="border border-border rounded-xl bg-card overflow-hidden shadow-xs">
        <Table>
          <TableHeader className="bg-muted/10">
            <TableRow>
              <TableHead className="w-[120px] text-xs font-bold">Reference</TableHead>
              <TableHead className="text-xs font-bold">Asset</TableHead>
              <TableHead className="text-xs font-bold">Issue Description</TableHead>
              <TableHead className="text-xs font-bold">Priority</TableHead>
              <TableHead className="text-xs font-bold">Status</TableHead>
              <TableHead className="text-xs font-bold">Raised By</TableHead>
              <TableHead className="text-xs font-bold">Date</TableHead>
              <TableHead className="text-right text-xs font-bold pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-xs text-muted-foreground">
                  No maintenance requests found.
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((req) => (
                <TableRow key={req.id} className="hover:bg-muted/5 transition-colors">
                  <TableCell className="py-3 font-mono text-[11px] font-semibold text-foreground">
                    {req.reference}
                  </TableCell>
                  <TableCell className="py-3">
                    <Link
                      href={`/assets/${req.asset_id}`}
                      className="group flex items-center gap-1.5 font-semibold text-xs text-foreground hover:text-primary transition-colors"
                    >
                      {req.asset?.name}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary transition-all" />
                    </Link>
                    <span className="font-mono text-[10px] text-muted-foreground block mt-0.5">
                      {req.asset?.asset_tag}
                    </span>
                  </TableCell>
                  <TableCell
                    className="py-3 text-xs text-muted-foreground max-w-[200px] truncate"
                    title={req.description}
                  >
                    {req.description}
                  </TableCell>
                  <TableCell className="py-3">
                    {getPriorityBadge(req.priority)}
                  </TableCell>
                  <TableCell className="py-3">
                    {getStatusBadge(req.status)}
                  </TableCell>
                  <TableCell className="py-3 text-xs text-foreground">
                    {req.reporter?.full_name || "Employee"}
                  </TableCell>
                  <TableCell className="py-3 text-xs text-muted-foreground">
                    {formatDate(req.created_at)}
                  </TableCell>
                  <TableCell className="py-3 text-right pr-6">
                    <Link href={`/maintenance/${req.id}`}>
                      <Button variant="outline" size="xs" className="gap-1 text-[11px]">
                        View
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
