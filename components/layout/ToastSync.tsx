"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

export function ToastSync() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const error = searchParams.get("error");
    const message = searchParams.get("message");

    if (error) {
      toast.error(error);
      // Clean query params
      const params = new URLSearchParams(searchParams.toString());
      params.delete("error");
      router.replace(`/dashboard${params.toString() ? `?${params.toString()}` : ""}`);
    } else if (message) {
      toast.success(message);
      // Clean query params
      const params = new URLSearchParams(searchParams.toString());
      params.delete("message");
      router.replace(`/dashboard${params.toString() ? `?${params.toString()}` : ""}`);
    }
  }, [searchParams, router]);

  return null;
}
