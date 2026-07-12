"use client"
import { useState, useEffect, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Edit2, CheckCircle, XCircle, Trash2, X, PlusCircle, User, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { PromoteRoleDialog } from "@/components/org-setup/PromoteRoleDialog";
import {
  createDepartment,
  updateDepartment,
  toggleDepartmentStatus,
} from "@/lib/actions/departments";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/actions/categories";
import {
  updateEmployeeDepartment,
  toggleEmployeeStatus,
} from "@/lib/actions/employees";
import type { Department, AssetCategory, CustomFieldDefinition, Profile, UserRole } from "@/lib/types";

interface OrgSetupClientProps {
  initialDepartments: Department[];
  initialCategories: AssetCategory[];
  initialEmployees: (Profile & { department_name?: string | null })[];
  eligibleHeads: {
    id: string;
    full_name: string;
    role: string;
    email: string;
  }[];
}

const roleBadgeStyles: Record<UserRole, string> = {
  admin: "border-primary/30 bg-primary/10 text-primary",
  asset_manager: "border-purple-500/30 bg-purple-500/10 text-purple-700",
  department_head: "border-blue-500/30 bg-blue-500/10 text-blue-700",
  employee: "border-muted bg-muted text-muted-foreground",
};

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

export function OrgSetupClient({
  initialDepartments,
  initialCategories,
  initialEmployees,
  eligibleHeads,
}: OrgSetupClientProps) {
  const router = useRouter();

  // --- Departments State ---
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [parentDepartmentId, setParentDepartmentId] = useState("");
  const [headId, setHeadId] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  // --- Categories State ---
  const [categories, setCategories] = useState<AssetCategory[]>(initialCategories);
  const [isCatSheetOpen, setIsCatSheetOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<AssetCategory | null>(null);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);

  // --- Employees State ---
  const [employees, setEmployees] = useState(initialEmployees);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Promote Dialog State
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promotingEmployee, setPromotingEmployee] = useState<{
    id: string;
    full_name: string;
    role: UserRole;
  } | null>(null);

  const [isPending, startTransition] = useTransition();

  // Synchronize state when initial props from server change
  useEffect(() => {
    setDepartments(initialDepartments);
  }, [initialDepartments]);

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  useEffect(() => {
    setEmployees(initialEmployees);
  }, [initialEmployees]);

  // --- Department Handlers ---
  function openCreate() {
    setEditingDept(null);
    setName("");
    setCode("");
    setParentDepartmentId("");
    setHeadId("");
    setStatus("active");
    setIsSheetOpen(true);
  }

  function openEdit(dept: Department) {
    setEditingDept(dept);
    setName(dept.name);
    setCode(dept.code);
    setParentDepartmentId(dept.parent_department_id || "");
    setHeadId(dept.head_id || "");
    setStatus(dept.status);
    setIsSheetOpen(true);
  }

  async function handleToggleStatus(id: string) {
    const res = await toggleDepartmentStatus(id);
    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success("Department status updated");
    setDepartments((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, status: d.status === "active" ? "inactive" : "active" }
          : d
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !code) {
      toast.error("Name and Code are required");
      return;
    }

    startTransition(async () => {
      if (editingDept) {
        const res = await updateDepartment(editingDept.id, {
          name,
          code,
          parentDepartmentId: parentDepartmentId || null,
          headId: headId || null,
          status,
        });

        if (res.error) {
          toast.error(res.error);
          return;
        }

        toast.success("Department updated successfully");
      } else {
        const res = await createDepartment({
          name,
          code,
          parentDepartmentId: parentDepartmentId || null,
          headId: headId || null,
        });

        if (res.error) {
          toast.error(res.error);
          return;
        }

        toast.success("Department created successfully");
      }

      setIsSheetOpen(false);
      router.refresh();
    });
  }

  // --- Category Handlers ---
  function openCreateCat() {
    setEditingCat(null);
    setCatName("");
    setCatDesc("");
    setCustomFields([]);
    setIsCatSheetOpen(true);
  }

  function openEditCat(cat: AssetCategory) {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatDesc(cat.description || "");
    setCustomFields(cat.custom_fields || []);
    setIsCatSheetOpen(true);
  }

  function handleAddField() {
    setCustomFields((prev) => [
      ...prev,
      { key: "", label: "", type: "text" },
    ]);
  }

  function handleRemoveField(index: number) {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  }

  function handleFieldChange(
    index: number,
    fieldKey: keyof CustomFieldDefinition,
    value: string
  ) {
    setCustomFields((prev) =>
      prev.map((field, i) => {
        if (i !== index) return field;
        const updated = { ...field, [fieldKey]: value };

        if (fieldKey === "label" && (!field.key || field.key === slugify(field.label))) {
          updated.key = slugify(value);
        }

        return updated;
      })
    );
  }

  function slugify(text: string) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "_")
      .replace(/^-+|-+$/g, "");
  }

  async function handleCatSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!catName) {
      toast.error("Category Name is required");
      return;
    }

    for (const f of customFields) {
      if (!f.key || !f.label) {
        toast.error("All custom fields must have a Key and a Label");
        return;
      }
    }

    startTransition(async () => {
      if (editingCat) {
        const res = await updateCategory(editingCat.id, {
          name: catName,
          description: catDesc || null,
          customFields,
        });

        if (res.error) {
          toast.error(res.error);
          return;
        }

        toast.success("Category updated successfully");
      } else {
        const res = await createCategory({
          name: catName,
          description: catDesc || null,
          customFields,
        });

        if (res.error) {
          toast.error(res.error);
          return;
        }

        toast.success("Category created successfully");
      }

      setIsCatSheetOpen(false);
      router.refresh();
    });
  }

  async function handleDeleteCat(id: string) {
    if (!confirm("Are you sure you want to delete this category? This action cannot be undone.")) {
      return;
    }

    const res = await deleteCategory(id);
    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success("Category deleted successfully");
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  // --- Employee Handlers ---
  async function handleDeptChange(profileId: string, deptId: string) {
    const targetDeptId = deptId === "none" ? null : deptId;
    const res = await updateEmployeeDepartment(profileId, targetDeptId);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success("Employee department updated");

    const deptName = targetDeptId
      ? departments.find((d) => d.id === targetDeptId)?.name ?? null
      : null;

    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === profileId
          ? { ...emp, department_id: targetDeptId, department_name: deptName }
          : emp
      )
    );
  }

  async function handleToggleEmployeeStatus(profileId: string) {
    const res = await toggleEmployeeStatus(profileId);
    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success("Employee status updated");
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === profileId
          ? { ...emp, status: emp.status === "active" ? "inactive" : "active" }
          : emp
      )
    );
  }

  function openPromote(emp: Profile) {
    setPromotingEmployee({
      id: emp.id,
      full_name: emp.full_name,
      role: emp.role,
    });
    setPromoteOpen(true);
  }

  // Filter Employees locally based on user criteria
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (
        searchQuery &&
        !emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !emp.email?.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      if (roleFilter && emp.role !== roleFilter) {
        return false;
      }
      if (deptFilter) {
        if (deptFilter === "none" && emp.department_id !== null) return false;
        if (deptFilter !== "none" && emp.department_id !== deptFilter) return false;
      }
      if (statusFilter && emp.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [employees, searchQuery, roleFilter, deptFilter, statusFilter]);

  // Filter out self from parent options to prevent circular dependency
  const parentOptions = departments.filter(
    (d) => !editingDept || d.id !== editingDept.id
  );

  return (
    <div className="w-full">
      <Tabs defaultValue="departments" className="w-full space-y-6">
        <TabsList>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="categories">Asset Categories</TabsTrigger>
          <TabsTrigger value="directory">Employee Directory</TabsTrigger>
        </TabsList>

        {/* Tab A: Departments */}
        <TabsContent value="departments" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-foreground">Departments</h3>
            <Button className="flex items-center gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Department
            </Button>
          </div>

          <div className="rounded-md border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Parent Department</TableHead>
                  <TableHead>Department Head</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      No departments configured yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="font-medium text-foreground">
                        {dept.name}
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground uppercase">
                          {dept.code}
                        </code>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {dept.parent_department_name || "—"}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {dept.head_name || "—"}
                      </TableCell>
                      <TableCell>
                        {dept.status === "active" ? (
                          <Badge variant="outline" className="border-success/30 bg-success/10 text-success flex w-fit items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="flex w-fit items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(dept)}
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(dept.id)}
                          className={
                            dept.status === "active"
                              ? "text-destructive hover:bg-destructive/10"
                              : "text-success hover:bg-success/10"
                          }
                        >
                          {dept.status === "active" ? "Deactivate" : "Activate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab B: Asset Categories */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-foreground">Asset Categories</h3>
            <Button className="flex items-center gap-1.5" onClick={openCreateCat}>
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          </div>

          <div className="rounded-md border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Custom Fields Count</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                      No categories configured yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium text-foreground">
                        {cat.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[300px] truncate">
                        {cat.description || "—"}
                      </TableCell>
                      <TableCell className="text-foreground font-semibold">
                        {cat.custom_fields?.length || 0} fields
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditCat(cat)}
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteCat(cat.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab C: Employee Directory */}
        <TabsContent value="directory" className="space-y-4">
          {/* Filters */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="search-input">Search</Label>
              <Input
                id="search-input"
                placeholder="Search name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="role-filter">Role</Label>
              <select
                id="role-filter"
                className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">All Roles</option>
                <option value="admin">Administrator</option>
                <option value="asset_manager">Asset Manager</option>
                <option value="department_head">Department Head</option>
                <option value="employee">Employee</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dept-filter">Department</Label>
              <select
                id="dept-filter"
                className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <option value="">All Departments</option>
                <option value="none">No Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="status-filter">Status</Label>
              <select
                id="status-filter"
                className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Directory Table */}
          <div className="rounded-md border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[180px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      No employees match your search criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-3">
                          {emp.avatar_url ? (
                            <img
                              src={emp.avatar_url}
                              alt={emp.full_name}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {getInitials(emp.full_name)}
                            </div>
                          )}
                          <span>{emp.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {emp.email}
                      </TableCell>
                      <TableCell>
                        <select
                          className="flex h-8 w-full rounded border border-input bg-transparent px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={emp.department_id || "none"}
                          onChange={(e) => handleDeptChange(emp.id, e.target.value)}
                        >
                          <option value="none">No Department</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={roleBadgeStyles[emp.role] || ""}
                        >
                          {getRoleLabel(emp.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {emp.status === "active" ? (
                          <Badge variant="outline" className="border-success/30 bg-success/10 text-success flex w-fit items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="flex w-fit items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openPromote(emp)}
                          className="text-primary hover:bg-primary/10 inline-flex items-center gap-1"
                        >
                          <Shield className="h-3 w-3" />
                          Role
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleEmployeeStatus(emp.id)}
                          className={
                            emp.status === "active"
                              ? "text-destructive hover:bg-destructive/10"
                              : "text-success hover:bg-success/10"
                          }
                        >
                          {emp.status === "active" ? "Deactivate" : "Activate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Department Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-[420px]">
          <form onSubmit={handleSubmit} className="h-full flex flex-col justify-between">
            <div className="space-y-4">
              <SheetHeader>
                <SheetTitle>
                  {editingDept ? "Edit Department" : "Add Department"}
                </SheetTitle>
                <SheetDescription>
                  Define a business department structure and assign a head.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-3 pt-4">
                <div className="space-y-1">
                  <Label htmlFor="dept-name">Department Name</Label>
                  <Input
                    id="dept-name"
                    placeholder="e.g. Engineering"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="dept-code">Department Code</Label>
                  <Input
                    id="dept-code"
                    placeholder="e.g. ENG"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="parent-dept">Parent Department</Label>
                  <select
                    id="parent-dept"
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={parentDepartmentId}
                    onChange={(e) => setParentDepartmentId(e.target.value)}
                  >
                    <option value="">None (Top-Level)</option>
                    {parentOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="dept-head">Department Head</Label>
                  <select
                    id="dept-head"
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={headId}
                    onChange={(e) => setHeadId(e.target.value)}
                  >
                    <option value="">None</option>
                    {eligibleHeads.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.full_name} ({h.email})
                      </option>
                    ))}
                  </select>
                </div>

                {editingDept && (
                  <div className="flex items-center justify-between pt-2">
                    <Label htmlFor="dept-status" className="cursor-pointer">
                      Status Active
                    </Label>
                    <Switch
                      id="dept-status"
                      checked={status === "active"}
                      onCheckedChange={(checked) =>
                        setStatus(checked ? "active" : "inactive")
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            <SheetFooter className="pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSheetOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Asset Category Sheet */}
      <Sheet open={isCatSheetOpen} onOpenChange={setIsCatSheetOpen}>
        <SheetContent className="sm:max-w-[480px]">
          <form onSubmit={handleCatSubmit} className="h-full flex flex-col justify-between">
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              <SheetHeader>
                <SheetTitle>
                  {editingCat ? "Edit Category" : "Add Asset Category"}
                </SheetTitle>
                <SheetDescription>
                  Define structural categories for resources. Add custom fields that apply to all items in this category.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 pt-4">
                <div className="space-y-1">
                  <Label htmlFor="cat-name">Category Name</Label>
                  <Input
                    id="cat-name"
                    placeholder="e.g. Laptops, Server Racks"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="cat-desc">Description</Label>
                  <Textarea
                    id="cat-desc"
                    placeholder="Provide a brief explanation of what items belong here."
                    value={catDesc}
                    onChange={(e) => setCatDesc(e.target.value)}
                    className="min-h-[70px]"
                  />
                </div>

                {/* Custom Fields Builder */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold text-foreground">
                      Dynamic Custom Fields
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAddField}
                      className="text-primary hover:bg-primary/10 gap-1"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      Add Field
                    </Button>
                  </div>

                  {customFields.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-2 text-center border border-dashed border-border rounded-md">
                      No custom fields added yet. Dynamic fields will show on the asset forms.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {customFields.map((field, idx) => (
                        <div key={idx} className="flex gap-2 items-center bg-muted/30 p-2 rounded-lg border border-border/50">
                          <div className="flex-1 space-y-1">
                            <Input
                              placeholder="Label (e.g. Warranty)"
                              value={field.label}
                              onChange={(e) =>
                                handleFieldChange(idx, "label", e.target.value)
                              }
                              className="h-8 text-xs"
                              required
                            />
                          </div>

                          <div className="flex-1 space-y-1">
                            <Input
                              placeholder="Key (slugified)"
                              value={field.key}
                              onChange={(e) =>
                                handleFieldChange(idx, "key", e.target.value)
                              }
                              className="h-8 font-mono text-xs"
                              required
                            />
                          </div>

                          <div className="w-[85px] space-y-1">
                            <select
                              className="flex h-8 w-full rounded-md border border-input bg-card px-2 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              value={field.type}
                              onChange={(e) =>
                                handleFieldChange(
                                  idx,
                                  "type",
                                  e.target.value as "text" | "number" | "date"
                                )
                              }
                            >
                              <option value="text">Text</option>
                              <option value="number">Number</option>
                              <option value="date">Date</option>
                            </select>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => handleRemoveField(idx)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <SheetFooter className="pt-6 border-t border-border mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCatSheetOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Role Promotion Dialog */}
      <PromoteRoleDialog
        isOpen={promoteOpen}
        onOpenChange={setPromoteOpen}
        employee={promotingEmployee}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
