"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AssetCategory, CustomFieldDefinition } from "@/lib/types";

export async function getCategories() {
  const supabase = await createClient();

  const { data: categories, error } = await supabase
    .from("asset_categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch categories: ${error.message}`);
  }

  return categories as AssetCategory[];
}

export async function createCategory(data: {
  name: string;
  description?: string | null;
  customFields?: CustomFieldDefinition[];
}) {
  const supabase = await createClient();

  // Check admin role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    throw new Error("Admin privileges required");
  }

  const { error } = await supabase.from("asset_categories").insert({
    name: data.name,
    description: data.description || null,
    custom_fields: data.customFields || [],
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/org-setup");
  return { success: true };
}

export async function updateCategory(
  id: string,
  data: {
    name: string;
    description?: string | null;
    customFields?: CustomFieldDefinition[];
  }
) {
  const supabase = await createClient();

  // Check admin role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    throw new Error("Admin privileges required");
  }

  const { error } = await supabase
    .from("asset_categories")
    .update({
      name: data.name,
      description: data.description || null,
      custom_fields: data.customFields || [],
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/org-setup");
  return { success: true };
}

export async function deleteCategory(id: string) {
  const supabase = await createClient();

  // Check admin role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    throw new Error("Admin privileges required");
  }

  // Check if any assets reference this category
  const { count, error: countError } = await supabase
    .from("assets")
    .select("*", { count: "exact", head: true })
    .eq("category_id", id);

  if (countError) {
    return { error: countError.message };
  }

  if (count && count > 0) {
    return { error: "Cannot delete a category that has assets assigned to it." };
  }

  const { error } = await supabase
    .from("asset_categories")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/org-setup");
  return { success: true };
}
