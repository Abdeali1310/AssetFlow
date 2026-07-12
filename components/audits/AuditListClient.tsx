"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck,
  Plus,
  Eye,
  Calendar,
  MapPin,
  Building2,
  Users,
  Search,
} from "lucide-react";
import { canCreateAuditCycle } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";

interface AuditListClientProps {
  initialCycles: any[];
  currentUserRole: UserRole;
}

export function AuditListClient({
  initialCycles,
  currentUserRole,
}: AuditListClientProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const isAdmin = canCreateAuditCycle(currentUserRole);

  const filtered = initialCycles.filter((cycle) => {
    if (statusFilter !== "all" && cycle.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchRef = cycle.reference?.toLowerCase().includes(q);
      const matchName = cycle.name?.toLowerCase().includes(q);
      if (!matchRef && !matchName) return false;
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      draft: {
        className: "bg-slate-500/10 text-slate-500 border-slate-500/20 hover:bg-slate-500/10",
        label: "Draft",
      },
      active: {
        className: "bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10",
        label: "Active",
      },
      closed: {
        className: "bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/10",
        label: "Closed",
      },
    };
    const c = config[status] || config.draft;
    return (
      <Badge className={`${c.className} text-[10px] uppercase font-bold py-0 px-2`}>
        {c.label}
      </Badge>
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Asset Audits
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage periodic verification cycles for organizational assets.
          </p>
        </div>
        {isAdmin && (
          <Link href="/audits/new">
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Audit Cycle
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by reference or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs bg-background border border-border rounded-lg py-2 pl-8 pr-3 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
        <div className="flex gap-1.5">
          {["all", "active", "closed", "draft"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors capitalize ${
                statusFilter === s
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-card border-border text-muted-foreground hover:bg-muted/20"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm bg-card border border-border rounded-xl">
          <ClipboardCheck className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="font-semibold">No audit cycles found</p>
          <p className="text-xs mt-1">
            {isAdmin
              ? "Create a new audit cycle to begin verifying assets."
              : "No audits matching current filters."}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Reference
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Scope
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Date Range
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Auditors
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Progress
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((cycle) => {
                  const progress = cycle.progress || { total: 0, checked: 0 };
                  const pct = progress.total > 0 ? Math.round((progress.checked / progress.total) * 100) : 0;
                  const scopeParts: string[] = [];
                  if (cycle.scope_department?.name) {
                    scopeParts.push(cycle.scope_department.name);
                  }
                  if (cycle.scope_location) {
                    scopeParts.push(cycle.scope_location);
                  }
                  const scopeLabel = scopeParts.length > 0 ? scopeParts.join(" · ") : "All Assets";

                  const auditorNames = (cycle.auditors || [])
                    .map((a: any) => a.auditor?.full_name || "Unknown")
                    .slice(0, 3);

                  return (
                    <tr key={cycle.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-foreground">
                          {cycle.reference}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground max-w-[200px] truncate">
                        {cycle.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          {cycle.scope_department?.name ? (
                            <Building2 className="h-3 w-3 shrink-0" />
                          ) : cycle.scope_location ? (
                            <MapPin className="h-3 w-3 shrink-0" />
                          ) : null}
                          <span className="truncate max-w-[140px]">{scopeLabel}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 shrink-0" />
                          {formatDate(cycle.start_date)} — {formatDate(cycle.end_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {auditorNames.map((name: string, idx: number) => (
                            <div
                              key={idx}
                              className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[9px] font-bold text-primary"
                              title={name}
                            >
                              {name
                                .split(" ")
                                .map((n: string) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </div>
                          ))}
                          {(cycle.auditors || []).length > 3 && (
                            <span className="text-[9px] text-muted-foreground font-semibold ml-0.5">
                              +{(cycle.auditors || []).length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(cycle.status)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-semibold text-foreground">
                              {progress.checked}/{progress.total}
                            </span>
                            <span className="text-muted-foreground">{pct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                pct === 100 ? "bg-green-500" : "bg-primary"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/audits/${cycle.id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-[10px]">
                            <Eye className="mr-1 h-3 w-3" />
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
