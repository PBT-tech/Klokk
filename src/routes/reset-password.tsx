import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KlokkFullLogo } from "@/components/klokk/logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Klokk" },
      {
        name: "description",
        content: "Reset your Klokk account password via email.",
      },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    const redirect =
      typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
    const opts: { redirectTo?: string } = {};
    if (redirect) opts.redirectTo = redirect;
    const { error } = await supabase.auth.resetPasswordForEmail(email, opts);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Reset link sent");
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-6 text-center">
        <Link to="/" className="inline-flex justify-center" aria-label="Klokk home">
          <KlokkFullLogo size="md" variant="stacked" />
        </Link>
      </div>
      <div className="rounded-2xl border border-border bg-card p-8 shadow-premium">
        {sent ? (
          <div className="text-center">
            <div className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-accent/15 text-accent">
              <MailCheck className="size-6" />
            </div>
            <h1 className="mt-5 font-display text-2xl font-semibold text-foreground">
              Check your inbox
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              If an account exists for <span className="font-medium text-foreground">{email}</span>,
              a reset link is on its way.
            </p>
            <Link to="/signin">
              <Button variant="outline" className="mt-6 w-full">
                <ArrowLeft className="size-4" />
                Back to sign in
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold text-foreground">Reset password</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Enter your email and we'll send you a reset link.
            </p>
            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  placeholder="you@studio.co"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                Send reset link
              </Button>
            </form>
            <Link
              to="/signin"
              className="mt-5 block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
