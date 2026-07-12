"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, X, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { generateAssetTag } from "@/lib/actions/assets";
import type { Asset, AssetCategory, Department } from "@/lib/types";

interface AssetFormProps {
  initialAsset?: Asset; // Present if editing
  categories: AssetCategory[];
  departments: Department[];
  onSubmit: (data: any) => Promise<{ error?: string; id?: string; success?: boolean }>;
  isSubmitting: boolean;
}

export function AssetForm({
  initialAsset,
  categories,
  departments,
  onSubmit,
  isSubmitting,
}: AssetFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const isEditMode = !!initialAsset;

  // Form Fields State
  const [name, setName] = useState(initialAsset?.name || "");
  const [categoryId, setCategoryId] = useState(initialAsset?.category_id || "");
  const [assetTag, setAssetTag] = useState(initialAsset?.asset_tag || "Generating...");
  const [serialNumber, setSerialNumber] = useState(initialAsset?.serial_number || "");
  const [acquisitionDate, setAcquisitionDate] = useState(initialAsset?.acquisition_date || "");
  const [acquisitionCost, setAcquisitionCost] = useState<number | "">(
    initialAsset?.acquisition_cost !== undefined && initialAsset?.acquisition_cost !== null
      ? Number(initialAsset.acquisition_cost)
      : ""
  );
  const [condition, setCondition] = useState<string>(initialAsset?.condition || "good");
  const [location, setLocation] = useState(initialAsset?.location || "");
  const [departmentId, setDepartmentId] = useState(initialAsset?.department_id || "");
  const [isBookable, setIsBookable] = useState(initialAsset?.is_bookable || false);
  const [photoUrl, setPhotoUrl] = useState(initialAsset?.photo_url || "");
  const [notes, setNotes] = useState(initialAsset?.notes || "");
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>(
    initialAsset?.custom_field_values || {}
  );

  // Loading States
  const [isUploading, setIsUploading] = useState(false);

  // Auto-generate Asset Tag on mount (create mode only)
  useEffect(() => {
    if (!isEditMode) {
      const fetchTag = async () => {
        try {
          const nextTag = await generateAssetTag();
          setAssetTag(nextTag);
        } catch (err: any) {
          toast.error("Failed to generate unique asset tag");
        }
      };
      fetchTag();
    }
  }, [isEditMode]);

  // Determine dynamic custom fields
  const selectedCat = categories.find((c) => c.id === categoryId);
  const customFields = selectedCat?.custom_fields || [];

  // File Upload Handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `asset-photos/${fileName}`;

      const { data, error } = await supabase.storage
        .from("asset-photos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (error) {
        throw new Error(error.message);
      }

      const { data: { publicUrl } } = supabase.storage
        .from("asset-photos")
        .getPublicUrl(filePath);

      setPhotoUrl(publicUrl);
      toast.success("Photo uploaded successfully");
    } catch (err: any) {
      toast.error(`Photo upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Product Name is required");
      return;
    }

    if (!categoryId) {
      toast.error("Asset Category is required");
      return;
    }

    const payload = {
      name: name.trim(),
      categoryId,
      assetTag,
      serialNumber: serialNumber.trim() || null,
      acquisitionDate: acquisitionDate || null,
      acquisitionCost: acquisitionCost === "" ? null : Number(acquisitionCost),
      condition,
      location: location.trim() || null,
      departmentId: departmentId || null,
      isBookable,
      photoUrl: photoUrl || null,
      customFieldValues,
      notes: notes.trim() || null,
    };

    const res = await onSubmit(payload);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(
        isEditMode ? "Asset updated successfully" : "Asset registered successfully"
      );
      router.push(`/assets/${res.id || initialAsset?.id}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl bg-card border border-border rounded-lg p-6 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Product Name */}
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs font-semibold text-foreground">
            Product Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="e.g. MacBook Pro 16-inch"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 text-xs"
            required
            disabled={isSubmitting}
          />
        </div>

        {/* Category Select */}
        <div className="space-y-1.5">
          <Label htmlFor="category" className="text-xs font-semibold text-foreground">
            Category <span className="text-destructive">*</span>
          </Label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setCustomFieldValues({}); // Clear custom fields on category change
            }}
            className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            required
            disabled={isSubmitting}
          >
            <option value="">Select Category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Asset Tag */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground">
            Asset Tag
          </Label>
          <Input
            value={assetTag}
            disabled
            className="h-9 text-xs font-mono bg-muted text-muted-foreground select-none"
          />
        </div>

        {/* Serial Number */}
        <div className="space-y-1.5">
          <Label htmlFor="serial" className="text-xs font-semibold text-foreground">
            Serial Number
          </Label>
          <Input
            id="serial"
            placeholder="e.g. C02X81FLJGH5"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            className="h-9 text-xs"
            disabled={isSubmitting}
          />
        </div>

        {/* Acquisition Date */}
        <div className="space-y-1.5">
          <Label htmlFor="acqDate" className="text-xs font-semibold text-foreground">
            Acquisition Date
          </Label>
          <Input
            id="acqDate"
            type="date"
            value={acquisitionDate}
            onChange={(e) => setAcquisitionDate(e.target.value)}
            className="h-9 text-xs"
            disabled={isSubmitting}
          />
        </div>

        {/* Acquisition Cost */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <Label htmlFor="acqCost" className="text-xs font-semibold text-foreground">
              Acquisition Cost
            </Label>
            <span className="text-[10px] text-muted-foreground">
              USD ($)
            </span>
          </div>
          <Input
            id="acqCost"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={acquisitionCost}
            onChange={(e) => setAcquisitionCost(e.target.value === "" ? "" : Number(e.target.value))}
            className="h-9 text-xs"
            disabled={isSubmitting}
          />
          <span className="text-[10.5px] text-muted-foreground italic flex items-center gap-1">
            <Info className="h-3 w-3 shrink-0" />
            For reporting only — not linked to accounting
          </span>
        </div>

        {/* Condition Select */}
        <div className="space-y-1.5">
          <Label htmlFor="condition" className="text-xs font-semibold text-foreground">
            Condition
          </Label>
          <select
            id="condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            disabled={isSubmitting}
          >
            <option value="new">New</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
            <option value="damaged">Damaged</option>
          </select>
        </div>

        {/* Home Department Select */}
        <div className="space-y-1.5">
          <Label htmlFor="dept" className="text-xs font-semibold text-foreground">
            Home Department
          </Label>
          <select
            id="dept"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            disabled={isSubmitting}
          >
            <option value="">None (Independent)</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name} ({dept.code})
              </option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="location" className="text-xs font-semibold text-foreground">
            Location
          </Label>
          <Input
            id="location"
            placeholder="e.g. Building A, Floor 2, Room 204"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="h-9 text-xs"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Dynamic Custom Fields Section */}
      {customFields.length > 0 && (
        <div className="border border-border/80 bg-muted/20 p-4 rounded-lg space-y-4">
          <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
            {selectedCat?.name} Specifications
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customFields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`cf-${field.key}`} className="text-xs font-semibold text-foreground capitalize">
                  {field.label}
                </Label>
                {field.type === "number" ? (
                  <Input
                    id={`cf-${field.key}`}
                    type="number"
                    value={customFieldValues[field.key] ?? ""}
                    onChange={(e) =>
                      setCustomFieldValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                    className="h-9 text-xs"
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    disabled={isSubmitting}
                  />
                ) : field.type === "date" ? (
                  <Input
                    id={`cf-${field.key}`}
                    type="date"
                    value={customFieldValues[field.key] ?? ""}
                    onChange={(e) =>
                      setCustomFieldValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    className="h-9 text-xs"
                    disabled={isSubmitting}
                  />
                ) : (
                  <Input
                    id={`cf-${field.key}`}
                    type="text"
                    value={customFieldValues[field.key] ?? ""}
                    onChange={(e) =>
                      setCustomFieldValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    className="h-9 text-xs"
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    disabled={isSubmitting}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bookable switch */}
      <div className="flex flex-col space-y-2 border border-border p-3.5 rounded-lg bg-card/60">
        <label className="flex items-center gap-2.5 font-semibold text-xs text-foreground select-none cursor-pointer">
          <input
            type="checkbox"
            checked={isBookable}
            onChange={(e) => setIsBookable(e.target.checked)}
            className="h-4.5 w-4.5 rounded border-input text-primary focus:ring-primary focus:ring-offset-0 bg-card transition"
            disabled={isSubmitting}
          />
          Shared / Bookable Resource
        </label>
        <span className="text-[11px] text-muted-foreground pl-7">
          This asset can be booked by time slots instead of being allocated permanently to a single employee.
        </span>
      </div>

      {/* Photo Upload */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-foreground">
          Asset Photo
        </Label>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="file"
              id="photo-file"
              className="hidden"
              accept="image/*"
              onChange={handlePhotoUpload}
              disabled={isUploading || isSubmitting}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading || isSubmitting}
              onClick={() => document.getElementById("photo-file")?.click()}
              className="text-xs h-9"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Upload Photo
                </>
              )}
            </Button>
          </div>

          {photoUrl && (
            <div className="relative w-20 h-20 rounded-lg border border-border overflow-hidden group">
              <img
                src={photoUrl}
                alt="Asset preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setPhotoUrl("")}
                className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground hover:bg-destructive/95 rounded-full p-0.5 transition-colors shadow-sm"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-xs font-semibold text-foreground">
          Notes
        </Label>
        <Textarea
          id="notes"
          rows={3}
          placeholder="Enter extra asset details, location details, transfer instructions, or warranty specifics..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="text-xs"
          disabled={isSubmitting}
        />
      </div>

      {/* Submit / Cancel Footer */}
      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting || isUploading}
          className="text-xs h-9"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || isUploading}
          className="text-xs h-9"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Saving...
            </>
          ) : isEditMode ? (
            "Save Changes"
          ) : (
            "Register Asset"
          )}
        </Button>
      </div>
    </form>
  );
}
