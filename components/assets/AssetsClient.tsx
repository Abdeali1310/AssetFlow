"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Edit2,
  SlidersHorizontal,
  X,
  Eye,
  BookMarked,
  Check,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, ColumnDefinition } from "@/components/shared/DataTable";
import { AssetStatusBadge } from "@/components/assets/AssetStatusBadge";
import { canRegisterAssets } from "@/lib/permissions";
import { getAssets } from "@/lib/actions/assets";
import type { Asset, AssetCategory, Department, UserRole } from "@/lib/types";

interface AssetsClientProps {
  initialAssets: Asset[];
  categories: AssetCategory[];
  departments: Department[];
  currentUserRole: UserRole;
  initialStatus?: string;
  initialCategoryId?: string;
}

function CopyableAssetTag({ tag }: { tag: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(tag);
      setCopied(true);
      toast.success(`Copied asset tag: ${tag}`);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy tag");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground border border-border transition-all select-all group cursor-pointer"
      title="Click to copy tag"
    >
      <span>{tag}</span>
      {copied ? (
        <Check className="h-3 w-3 text-success animate-in fade-in zoom-in-50 duration-200" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
      )}
    </button>
  );
}

function ConditionBadge({ condition }: { condition: string }) {
  const config: Record<
    string,
    { label: string; bg: string; text: string; border: string }
  > = {
    new: { label: "New", bg: "bg-success/10", text: "text-success", border: "border-success/20" },
    good: { label: "Good", bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
    fair: { label: "Fair", bg: "bg-warning/10", text: "text-warning", border: "border-warning/20" },
    poor: { label: "Poor", bg: "bg-amber-600/10", text: "text-amber-600", border: "border-amber-600/20" },
    damaged: { label: "Damaged", bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/20" },
  };

  const current = config[condition] || {
    label: condition,
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border capitalize ${current.bg} ${current.text} ${current.border}`}
    >
      {current.label}
    </span>
  );
}

export function AssetsClient({
  initialAssets,
  categories,
  departments,
  currentUserRole,
  initialStatus,
  initialCategoryId,
}: AssetsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Search & Filters State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState(initialCategoryId || "all");
  const [status, setStatus] = useState(initialStatus || "all");
  const [departmentId, setDepartmentId] = useState("all");
  const [isBookable, setIsBookable] = useState(false);

  // Asset list state
  const [assets, setAssets] = useState<Asset[]>(initialAssets);

  // Sync initialAssets on server update
  useEffect(() => {
    setAssets(initialAssets);
  }, [initialAssets]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Query database on filter changes
  useEffect(() => {
    // Only skip fetching if it matches the initial loaded state to save database queries
    const matchesInitial =
      debouncedSearch === "" &&
      categoryId === (initialCategoryId || "all") &&
      status === (initialStatus || "all") &&
      departmentId === "all" &&
      !isBookable;

    if (matchesInitial && assets === initialAssets) {
      return;
    }

    startTransition(async () => {
      try {
        const filters = {
          search: debouncedSearch || undefined,
          categoryId: categoryId === "all" ? undefined : categoryId,
          status: status === "all" ? undefined : status,
          departmentId: departmentId === "all" ? undefined : departmentId,
          isBookable: isBookable || undefined,
        };
        const data = await getAssets(filters);
        setAssets(data);
      } catch (err: any) {
        toast.error("Failed to retrieve filtered assets");
      }
    });
  }, [debouncedSearch, categoryId, status, departmentId, isBookable]);

  const handleResetFilters = () => {
    setSearch("");
    setCategoryId("all");
    setStatus("all");
    setDepartmentId("all");
    setIsBookable(false);
  };

  const isFilterActive =
    search !== "" ||
    categoryId !== "all" ||
    status !== "all" ||
    departmentId !== "all" ||
    isBookable;

  const canRegister = canRegisterAssets(currentUserRole);

  // Table Column Definitions
  const columns: ColumnDefinition<Asset>[] = [
    {
      key: "asset_tag",
      label: "Asset Tag",
      sortable: true,
      render: (row) => <CopyableAssetTag tag={row.asset_tag} />,
    },
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (row) => (
        <span className="font-medium text-foreground hover:underline decoration-primary/40 underline-offset-2">
          {row.name}
        </span>
      ),
    },
    {
      key: "category_name",
      label: "Category",
      sortable: true,
      render: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground border border-border">
          {row.category_name || "Uncategorized"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row) => <AssetStatusBadge status={row.status} />,
    },
    {
      key: "current_holder_name",
      label: "Current Holder",
      sortable: true,
      render: (row) => (
        <span className="text-sm font-medium text-foreground/80">
          {row.current_holder_name || "—"}
        </span>
      ),
    },
    {
      key: "location",
      label: "Location",
      sortable: true,
      render: (row) => (
        <span className="text-muted-foreground text-xs">
          {row.location || "—"}
        </span>
      ),
    },
    {
      key: "condition",
      label: "Condition",
      sortable: true,
      render: (row) => <ConditionBadge condition={row.condition} />,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/assets/${row.id}`);
            }}
            title="View Details"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {canRegister && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/assets/${row.id}?edit=true`);
              }}
              title="Edit Asset"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Asset Directory
          </h2>
          <span className="inline-flex h-6 items-center justify-center rounded-full bg-primary/10 px-2.5 text-xs font-semibold text-primary border border-primary/20">
            {assets.length} total
          </span>
        </div>
        {canRegister && (
          <Button
            onClick={() => router.push("/assets/new")}
            className="flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Register Asset
          </Button>
        )}
      </div>

      {/* Filter and search bar */}
      <div className="bg-card rounded-lg border border-border p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            Filters & Sorting
          </div>
          {isFilterActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <X className="h-3 w-3" />
              Reset Filters
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search tag, serial, or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          {/* Category Select */}
          <div className="space-y-1">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Select */}
          <div className="space-y-1">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">All Statuses</option>
              <option value="available">Available</option>
              <option value="allocated">Allocated</option>
              <option value="reserved">Reserved</option>
              <option value="under_maintenance">In Maintenance</option>
              <option value="lost">Lost</option>
              <option value="retired">Retired</option>
              <option value="disposed">Disposed</option>
            </select>
          </div>

          {/* Department Select */}
          <div className="space-y-1">
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">All Home Depts</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bookable only Filter Toggle */}
        <div className="flex items-center space-x-2 pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground font-medium select-none">
            <input
              type="checkbox"
              checked={isBookable}
              onChange={(e) => setIsBookable(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-primary focus:ring-offset-0 bg-card transition"
            />
            <BookMarked className="h-3.5 w-3.5 text-primary" />
            Show Bookable / Shared Resources Only
          </label>
        </div>
      </div>

      {/* Main Asset Directory Table */}
      <DataTable
        columns={columns}
        data={assets}
        loading={isPending}
        emptyMessage={{
          title: "No assets found",
          description: isFilterActive
            ? "Try loosening your filters or adjusting your search term."
            : "Get started by registering your first asset using the button above.",
        }}
        onRowClick={(row) => router.push(`/assets/${row.id}`)}
      />
    </div>
  );
}
