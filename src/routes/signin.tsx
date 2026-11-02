import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KlokkFullLogo } from "@/components/klokk/logo";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/klokk-hooks";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign in to Klokk" },
      {
        name: "description",
        content: "Sign in to your Klokk account to manage your scheduling events.",
      },
    ],
  }),
  component: SignIn,
});

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

type FormValues = z.infer<typeof schema>;

function SignIn() {
  const navigate = useNavigate();
  const session = useSession();

  if (session) {
    navigate({ to: "/dashboard" });
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Network connection error. Please refresh the page and try again.",
      );
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-6 text-center">
        <Link to="/" className="inline-flex justify-center" aria-label="Klokk home">
          <KlokkFullLogo size="md" variant="horizontal" imgClassName="h-[208px] max-w-[728px]" />
        </Link>
      </div>
      <div className="rounded-2xl border border-border bg-card p-8 shadow-premium">
        <h1 className="font-display text-2xl font-semibold text-chart-4">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Sign in to manage your events.</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Email</Label>
            <Input type="email" placeholder="you@studio.co" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">Password</Label>
              <Link
                to="/reset-password"
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input type="password" placeholder="Your password" {...register("password")} />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            Sign in
            <ArrowRight className="size-4" />
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          New to Klokk?{" "}
          <Link
            to="/signup"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
