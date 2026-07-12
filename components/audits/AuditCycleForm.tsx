"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAuditCycle } from "@/lib/actions/audits";
import {
  ClipboardCheck,
  Calendar,
  Building2,
  MapPin,
  Users,
  ArrowRight,
  AlertTriangle,
  Info,
  Check,
  X,
} from "lucide-react";

interface AuditCycleFormProps {
  departments: { id: string; name: string }[];
  eligibleAuditors: { id: string; full_name: string; role: string }[];
}

export function AuditCycleForm({
  departments,
  eligibleAuditors,
}: AuditCycleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [name, setName] = useState("");
  const [scopeDepartmentId, setScopeDepartmentId] = useState("");
  const [scopeLocation, setScopeLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const toggleAuditor = (id: string) => {
    setSelectedAuditors((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const getRoleLabel = (role: string) => {
    const m: Record<string, string> = {
      admin: "Admin",
      asset_manager: "Asset Mgr",
      department_head: "Dept. Head",
    };
    return m[role] || role;
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Audit cycle name is required.");
      return;
    }

    if (!startDate || !endDate) {
      setFormError("Start and end dates are required.");
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      setFormError("End date must be after start date.");
      return;
    }

    if (selectedAuditors.length === 0) {
      setFormError("At least one auditor must be assigned.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createAuditCycle({
          name,
          scopeDepartmentId: scopeDepartmentId || null,
          scopeLocation: scopeLocation || null,
          startDate,
          endDate,
          auditorIds: selectedAuditors,
        });

        if (res.error) {
          setFormError(res.error);
          return;
        }

        toast.success("Audit cycle created and activated successfully.");
        if (res.data?.id) {
          router.push(`/audits/${res.data.id}`);
        } else {
          router.push("/audits");
        }
        router.refresh();
      } catch (err: any) {
        setFormError("Failed to create audit cycle.");
      }
    });
  };

  return (
    <div className="max-w-xl mx-auto bg-card border border-border rounded-xl shadow-xs overflow-hidden">
      <div className="border-b border-border p-5 bg-muted/10">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          Create Audit Cycle
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Define a new asset audit cycle. Assets matching the scope will be auto-populated for verification.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        {/* Error */}
        {formError && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2.5 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="font-bold">{formError}</span>
          </div>
        )}

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <ClipboardCheck className="h-3 w-3" />
            Audit Cycle Name
          </label>
          <Input
            placeholder="e.g. Q3 2026 IT Equipment Audit"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* Scope section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Scope (Optional)
            </h3>
          </div>

          <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg flex items-start gap-2 text-[10px] text-blue-600">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Leave both department and location blank to audit all assets in the organization.</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                Department
              </label>
              <select
                value={scopeDepartmentId}
                onChange={(e) => setScopeDepartmentId(e.target.value)}
                className="w-full text-xs bg-background border border-border rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Location Filter
              </label>
              <Input
                placeholder="e.g. Building A, Floor 2"
                value={scopeLocation}
                onChange={(e) => setScopeLocation(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
        </div>

        {/* Date Range */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Audit Period
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-semibold text-muted-foreground uppercase">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-semibold text-muted-foreground uppercase">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="text-xs"
              />
            </div>
          </div>
        </div>

        {/* Auditor Selection */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />
            Assign Auditors
            {selectedAuditors.length > 0 && (
              <span className="ml-1 text-primary font-black">
                ({selectedAuditors.length} selected)
              </span>
            )}
          </label>
          <p className="text-[10px] text-muted-foreground">
            Select administrators, asset managers, or department heads to conduct this audit.
          </p>

          <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
            {eligibleAuditors.map((auditor) => {
              const isSelected = selectedAuditors.includes(auditor.id);
              return (
                <button
                  key={auditor.id}
                  type="button"
                  onClick={() => toggleAuditor(auditor.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border hover:bg-muted/10"
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {getInitials(auditor.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {auditor.full_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {getRoleLabel(auditor.role)}
                    </p>
                  </div>
                  <div
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-border"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-border/80">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? (
              "Creating..."
            ) : (
              <>
                Create & Activate
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
