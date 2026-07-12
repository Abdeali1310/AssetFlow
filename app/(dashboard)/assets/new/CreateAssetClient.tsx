"use client";

import React, { useTransition } from "react";
import { AssetForm } from "@/components/assets/AssetForm";
import { createAsset } from "@/lib/actions/assets";
import type { AssetCategory, Department } from "@/lib/types";

interface CreateAssetClientProps {
  categories: AssetCategory[];
  departments: Department[];
}

export function CreateAssetClient({
  categories,
  departments,
}: CreateAssetClientProps) {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (payload: any) => {
    return new Promise<{ error?: string; id?: string }>((resolve) => {
      startTransition(async () => {
        try {
          const res = await createAsset(payload);
          resolve(res);
        } catch (err: any) {
          resolve({ error: err.message || "Failed to create asset" });
        }
      });
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col gap-1 border-b border-border pb-5">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Register New Asset
        </h2>
        <p className="text-sm text-muted-foreground">
          Enter details to register a new physical asset in the system inventory.
        </p>
      </div>

      <AssetForm
        categories={categories}
        departments={departments}
        onSubmit={handleSubmit}
        isSubmitting={isPending}
      />
    </div>
  );
}
