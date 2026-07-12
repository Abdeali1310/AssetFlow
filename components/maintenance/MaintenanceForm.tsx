"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { raiseMaintenanceRequest, uploadMaintenancePhotoAction } from "@/lib/actions/maintenance";
import {
  Wrench,
  AlertTriangle,
  FileImage,
  Trash2,
  Boxes,
  Bookmark,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface MaintenanceFormProps {
  assets: any[];
  prefilledAssetId?: string;
}

export function MaintenanceForm({
  assets,
  prefilledAssetId = "",
}: MaintenanceFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  // Form State
  const [assetId, setAssetId] = useState(prefilledAssetId);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [photoUrl, setPhotoUrl] = useState("");

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize prefilled asset ID
  useEffect(() => {
    if (prefilledAssetId) {
      setAssetId(prefilledAssetId);
    } else if (assets.length > 0 && !assetId) {
      setAssetId(assets[0].id);
    }
  }, [assets, prefilledAssetId]);

  // Handle Photo Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(",")[1];
          const res = await uploadMaintenancePhotoAction(base64Data, file.name, file.type);
          if (res.error) {
            toast.error(`Photo upload failed: ${res.error}`);
          } else if (res.publicUrl) {
            setPhotoUrl(res.publicUrl);
            toast.success("Photo uploaded successfully");
          }
        } catch (err: any) {
          toast.error(`Photo upload failed: ${err.message}`);
        } finally {
          setIsUploading(false);
        }
      };
      reader.onerror = () => {
        toast.error("Failed to read file.");
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error(`Photo upload failed: ${err.message}`);
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl("");
    toast.success("Photo removed");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!assetId) {
      setFormError("Please select an asset.");
      return;
    }

    if (!description.trim()) {
      setFormError("Issue description is required.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await raiseMaintenanceRequest({
          assetId,
          issueDescription: description,
          priority,
          photoUrl: photoUrl || undefined,
        });

        if (res.error) {
          setFormError(res.error);
          return;
        }

        toast.success("Maintenance request submitted successfully.");
        // Redirect to detail page (which will be built in Task 24)
        if (res.data?.id) {
          router.push(`/maintenance/${res.data.id}`);
        } else {
          router.push("/maintenance");
        }
        router.refresh();
      } catch (err: any) {
        setFormError("Failed to submit request.");
      }
    });
  };

  return (
    <div className="max-w-xl mx-auto bg-card border border-border rounded-xl shadow-xs overflow-hidden">
      <div className="border-b border-border p-5 bg-muted/10">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          Raise Maintenance Request
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Report hardware failures, damage, or operational defects. The asset status remains unchanged until inspection.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {/* Error Alert Display */}
        {formError && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2.5 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="font-bold">{formError}</span>
          </div>
        )}

        {/* Asset Selection */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Boxes className="h-3 w-3" />
            Target Asset / Equipment
          </label>
          <select
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            disabled={!!prefilledAssetId}
            className="w-full text-xs bg-background border border-border rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:bg-muted disabled:text-muted-foreground cursor-pointer"
          >
            <option value="" disabled>
              Select asset...
            </option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name} ({asset.asset_tag})
              </option>
            ))}
          </select>
        </div>

        {/* Priority Selection */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Issue Priority
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: "low", label: "Low", desc: "Cosmetic / Minor" },
              { value: "medium", label: "Medium", desc: "Performance dips" },
              { value: "high", label: "High", desc: "Partially unusable" },
              { value: "critical", label: "Critical", desc: "Complete failure" },
            ].map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value as any)}
                className={`p-2 border rounded-lg flex flex-col items-center text-center gap-0.5 transition-all ${
                  priority === p.value
                    ? "border-primary bg-primary/5 text-primary font-semibold ring-1 ring-primary"
                    : "border-border hover:bg-muted/10 text-muted-foreground"
                }`}
              >
                <span className="text-xs">{p.label}</span>
                <span className="text-[9px] opacity-75 font-normal line-clamp-1">
                  {p.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Issue Description */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Bookmark className="h-3 w-3" />
            Description of the Issue
          </label>
          <Textarea
            placeholder="Explain exactly what is wrong. Include symptoms, when it started, and any troubleshooting done..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="text-xs min-h-[110px] resize-none"
            required
          />
        </div>

        {/* Photo Upload Option */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <FileImage className="h-3 w-3" />
            Defect Photograph (Optional)
          </label>

          {!photoUrl ? (
            <div className="border border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-muted/5 transition-colors relative cursor-pointer group">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={isUploading}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {isUploading ? (
                <div className="flex flex-col items-center gap-1">
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Uploading image...
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <FileImage className="h-6 w-6 mx-auto text-muted-foreground group-hover:text-primary transition-colors" />
                  <p className="text-xs font-semibold text-foreground">
                    Upload a photo of the defect
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    PNG, JPG, or WEBP up to 5MB
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="relative border border-border rounded-xl overflow-hidden group max-w-xs mx-auto">
              <img
                src={photoUrl}
                alt="Defect"
                className="w-full h-40 object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-xs"
                  onClick={handleRemovePhoto}
                  className="rounded-full shadow-md"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
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
          <Button type="submit" size="sm" disabled={isPending || isUploading}>
            {isPending ? (
              "Submitting..."
            ) : (
              <>
                Submit Request
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
