import { useEffect, useState } from "react";
import { CalendarClock, Globe, Package, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaymentCheckoutBlock } from "@/integrations/payments";
import { useBilling, useClaimOrder, useUpdateEmbedSettings } from "@/lib/klokk-hooks";
import { FREE_LIFETIME_EVENTS } from "@/lib/klokk-limits";
import type { KlokkAccount } from "@/lib/klokk-types";

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-premium">
      <h2 className="font-display text-lg font-semibold text-card-foreground">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

const PLAN_LABEL: Record<string, string> = {
  free: "Free (Trial)",
  casual: "Casual (Credit Packs)",
  organiser: "Organiser",
  teams: "Teams",
};

export function BillingTab() {
  const billing = useBilling();
  const claim = useClaimOrder();
  const [open, setOpen] = useState(false);

  if (!billing) {
    return <p className="text-sm text-muted-foreground">Loading your plan…</p>;
  }

  const freeLeft = Math.max(0, FREE_LIFETIME_EVENTS - billing.eventsCreated);
  const soon =
    billing.nextExpiry && new Date(billing.nextExpiry).getTime() - Date.now() < 7 * 86_400_000;

  return (
    <div className="space-y-8">
      <Card title="Your plan" subtitle="What you're on and what's left.">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-border/60 pb-3">
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="font-medium text-card-foreground">{PLAN_LABEL[billing.plan]}</dd>
          </div>
          {billing.plan === "free" && (
            <div className="flex justify-between border-b border-border/60 pb-3">
              <dt className="text-muted-foreground">Free events left</dt>
              <dd className="font-medium text-card-foreground">
                {freeLeft} of {FREE_LIFETIME_EVENTS}
              </dd>
            </div>
          )}
          {billing.plan === "casual" && (
            <div className="flex justify-between border-b border-border/60 pb-3">
              <dt className="text-muted-foreground">Event credits left</dt>
              <dd className="font-medium text-card-foreground">{billing.creditsLeft}</dd>
            </div>
          )}
          {(billing.plan === "organiser" || billing.plan === "teams") && (
            <>
              <div className="flex justify-between border-b border-border/60 pb-3">
                <dt className="text-muted-foreground">Billing</dt>
                <dd className="font-medium text-card-foreground">
                  {billing.billingInterval === "year" ? "Annual" : "Monthly"}
                  {billing.billingStatus !== "active" &&
                    ` · ${billing.billingStatus.replace("_", " ")}`}
                </dd>
              </div>
              {billing.planRenewsAt && (
                <div className="flex justify-between border-b border-border/60 pb-3">
                  <dt className="text-muted-foreground">
                    {billing.billingStatus === "cancelled" ? "Access until" : "Renews"}
                  </dt>
                  <dd className="font-medium text-card-foreground">
                    {new Date(billing.planRenewsAt).toLocaleDateString()}
                  </dd>
                </div>
              )}
            </>
          )}
          {billing.plan === "teams" && (
            <div className="flex justify-between border-b border-border/60 pb-3">
              <dt className="text-muted-foreground">Organiser seats</dt>
              <dd className="font-medium text-card-foreground">{3 + billing.extraSeats}</dd>
            </div>
          )}
        </dl>

        {/* Non-intrusive upgrade prompts (never shown while creating an event). */}
        {billing.plan === "free" && freeLeft === 0 && (
          <p className="mt-4 rounded-lg border border-border bg-surface/60 p-3 text-sm text-foreground">
            You've used all {FREE_LIFETIME_EVENTS} free events. A credit pack starts at $25 for 5
            events, or Organiser is $17/month for unlimited events.
          </p>
        )}
        {billing.plan === "casual" && (billing.creditsLeft === 0 || soon) && (
          <p className="mt-4 rounded-lg border border-border bg-surface/60 p-3 text-sm text-foreground">
            {billing.creditsLeft === 0
              ? "You're out of event credits."
              : "Your credit pack expires within 7 days."}{" "}
            If you run more than a few events a month, Organiser ($17/month, unlimited events) costs
            less than buying packs.
          </p>
        )}

        <div className="mt-5">
          <Button onClick={() => setOpen(true)} className="shadow-premium">
            <Package className="size-4" />
            {billing.plan === "free" ? "Buy a pack or subscribe" : "Change plan or buy a pack"}
          </Button>
        </div>
      </Card>

      {billing.packs.length > 0 && (
        <Card
          title="Credit packs"
          subtitle="Each pack covers a set number of events and expires 3 months after purchase."
        >
          <ul className="space-y-2 text-sm">
            {billing.packs.map((k) => {
              const expired = new Date(k.expiresAt).getTime() < Date.now();
              return (
                <li
                  key={k.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <span className={expired ? "text-muted-foreground line-through" : ""}>
                    {k.eventsTotal - k.eventsUsed} of {k.eventsTotal} events left
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="size-3.5" />
                    {expired ? "Expired" : "Expires"} {new Date(k.expiresAt).toLocaleDateString()}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose your plan</DialogTitle>
            <DialogDescription>
              Credit packs, Organiser and Teams. Your plan updates as soon as payment is confirmed.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto py-2">
            {open && (
              <PaymentCheckoutBlock
                checkoutMode="all"
                onSuccess={(order) => {
                  claim.mutate(
                    { orderId: order.orderId },
                    {
                      onSuccess: () => {
                        toast.success("Payment confirmed — your plan has been updated");
                        setOpen(false);
                      },
                      onError: (e) =>
                        toast.error(
                          e instanceof Error
                            ? e.message
                            : "Payment received, but we couldn't update your plan yet. It will update shortly.",
                        ),
                    },
                  );
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function EmbedTab({ account }: { account: KlokkAccount }) {
  const update = useUpdateEmbedSettings();
  const initial = account.embedSettings;
  const [domains, setDomains] = useState<string[]>(initial?.domainAllowlist ?? []);
  const [draft, setDraft] = useState("");
  const [accent, setAccent] = useState(initial?.accentOverride ?? "#c9a84c");

  useEffect(() => {
    setDomains(initial?.domainAllowlist ?? []);
    setAccent(initial?.accentOverride ?? "#c9a84c");
  }, [initial]);

  const addDomain = () => {
    const d = draft
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    if (!/^(\*\.)?[a-z0-9.-]+\.[a-z]{2,}(:\d+)?$/.test(d)) {
      toast.error("Enter a domain like www.example.com or *.example.com");
      return;
    }
    if (!domains.includes(d)) setDomains([...domains, d]);
    setDraft("");
  };

  const save = () => {
    if (!/^#[0-9a-fA-F]{6}$/.test(accent)) {
      toast.error("Accent colour must look like #c9a84c");
      return;
    }
    update.mutate(
      { settings: { accentOverride: accent, domainAllowlist: domains, embedExpiry: "" } },
      {
        onSuccess: () => toast.success("Embed settings saved"),
        onError: () => toast.error("Could not save"),
      },
    );
  };

  return (
    <div className="space-y-8">
      <Card
        title="Where your embeds may appear"
        subtitle="Embeds only load on the websites you list here. Anything else is blocked by the browser."
      >
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDomain();
              }
            }}
            placeholder="www.yoursite.com"
            className="bg-card text-card-foreground"
          />
          <Button type="button" onClick={addDomain} variant="outline">
            <Globe className="size-4" />
            Add
          </Button>
        </div>
        {domains.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No domains yet, so no website can show your embeds.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {domains.map((d) => (
              <li
                key={d}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                {d}
                <button
                  type="button"
                  aria-label={`Remove ${d}`}
                  onClick={() => setDomains(domains.filter((x) => x !== d))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Accent colour"
        subtitle="Applied to the buttons and highlights inside your embeds."
      >
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#c9a84c"}
            onChange={(e) => setAccent(e.target.value)}
            aria-label="Accent colour"
            className="h-10 w-14 cursor-pointer rounded border border-border bg-card"
          />
          <Input
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="max-w-[9rem] bg-card text-card-foreground"
          />
        </div>
      </Card>

      <Button onClick={save} disabled={update.isPending} className="shadow-premium">
        Save embed settings
      </Button>
    </div>
  );
}
