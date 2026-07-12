"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Boxes, Mail, Loader2, CircleCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setSubmittedEmail(values.email);
    setIsSuccess(true);
  }

  return (
    <div className="w-full max-w-[440px] space-y-8">
      {/* Wordmark */}
      <div className="flex flex-col items-center space-y-2">
        <div className="flex items-center gap-2">
          <Boxes className="h-7 w-7 text-primary" />
          <span className="text-2xl font-semibold tracking-tight text-foreground">
            AssetFlow
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Enterprise Asset &amp; Resource Management
        </p>
      </div>

      {/* Card */}
      <Card className="border-border/60 shadow-sm">
        {isSuccess ? (
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-success/10 p-3 text-success">
                <CircleCheck className="h-10 w-10" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Check your inbox</h2>
              <p className="text-sm text-muted-foreground">
                We have sent a reset link to{" "}
                <span className="font-medium text-foreground">{submittedEmail}</span>.
              </p>
            </div>
            <div className="pt-2">
              <Link href="/login">
                <Button className="w-full">Back to Sign In</Button>
              </Link>
            </div>
          </CardContent>
        ) : (
          <>
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl font-semibold">
                Reset your password
              </CardTitle>
              <CardDescription>
                We will email you a reset link
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      className="pl-9"
                      {...register("email")}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-destructive">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Link...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>

      {!isSuccess && (
        <p className="text-center text-sm text-muted-foreground">
          Remember your password?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
