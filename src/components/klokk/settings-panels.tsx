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
import { eventsWarning } from "@/lib/klokk-warnings";
import { LimitBanner } from "@/components/klokk/limit-banner";
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

const ORDER_KEY = "klokk-last-order";
const rememberOrder = (id: string) => {
  try {
    localStorage.setItem(ORDER_KEY, id);
  } catch {
    /* storage unavailable */
  }
};
const lastOrder = (): string | undefined => {
  try {
    return localStorage.getItem(ORDER_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};
const forgetOrder = () => {
  try {
    localStorage.removeItem(ORDER_KEY);
  } catch {
    /* storage unavailable */
  }
};

const PLANS = [
  {
    id: "free",
    name: "Free (Trial)",
    price: "$0",
    cta: "",
    points: ["3 events in total", "Up to 35 participants per event", "1 organiser seat"],
  },
  {
    id: "casual",
    name: "Casual (Credit Packs)",
    price: "$25 for 5 · $45 for 10 · $60 for 15 events",
    cta: "Buy a credit pack",
    points: [
      "Credits expire 3 months after purchase",
      "35 participants per event included",
      "Extra participants: $6.20 per block of 5 (36–50), then $5.30, charged per event",
    ],
  },
  {
    id: "organiser",
    name: "Organiser",
    price: "$17 / month",
    cta: "Choose Organiser",
    points: [
      "Unlimited events",
      "Up to 80 participants per event",
      "Annual: pay for 10 months, get 12",
    ],
  },
  {
    id: "teams",
    name: "Teams",
    price: "$35 / month + $8 / extra seat",
    cta: "Choose Teams",
    points: [
      "3 organiser seats included",
      "Unlimited events and participants",
      "Annual: pay for 10 months, get 12",
    ],
  },
] as const;

function cancelMailto(plan: string): string {
  const subject = encodeURIComponent("Klokk: change or cancel my plan");
  const body = encodeURIComponent(
    `Hi, please change or cancel my Klokk ${plan} plan at the end of my current billing period.\n\nMy account email: `,
  );
  return `mailto:info@platinumbusinessteams.com?subject=${subject}&body=${body}`;
}

export function BillingTab() {
  const billing = useBilling();
  const claim = useClaimOrder();
  const [open, setOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<string | undefined>(() => lastOrder());

  // HighLevel can take a few seconds to make a new order readable, so retry a few times.
  const claimWithRetry = async (orderId: string) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await claim.mutateAsync({ orderId });
        forgetOrder();
        setPendingOrder(undefined);
        toast.success("Payment confirmed — your plan has been updated");
        setOpen(false);
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        const retryable = /could not verify|not been paid|could not be read/i.test(msg);
        if (!retryable || attempt === 4) {
          setPendingOrder(orderId);
          toast.error(
            retryable
              ? "Payment received, but we couldn't confirm it yet. Use “Re-check my payment” in a minute."
              : msg || "We couldn't update your plan.",
          );
          setOpen(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      }
    }
  };

  if (!billing) {
    return <p className="text-sm text-muted-foreground">Loading your plan…</p>;
  }

  const freeLeft = Math.max(0, FREE_LIFETIME_EVENTS - billing.eventsCreated);
  const warning = eventsWarning(billing);

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

        {warning && <LimitBanner warning={warning} />}

        <div className="mt-5">
          <Button onClick={() => setOpen(true)} className="shadow-premium">
            <Package className="size-4" />
            {billing.plan === "free" ? "Buy a pack or subscribe" : "Change plan or buy a pack"}
          </Button>
        </div>
      </Card>

      <Card
        title="Choose a plan"
        subtitle="Prices are in Australian dollars. Annual billing on Organiser and Teams includes 2 months free."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {PLANS.map((p) => {
            const current = billing.plan === p.id;
            return (
              <div
                key={p.id}
                className={`flex flex-col rounded-xl border p-4 ${current ? "border-primary/60 bg-primary/5" : "border-border"}`}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-display text-base font-semibold text-card-foreground">
                    {p.name}
                  </h3>
                  {current && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Current plan
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium text-card-foreground">{p.price}</p>
                <ul className="mt-3 flex-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {p.points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
                {p.id === "free" ? (
                  billing.plan !== "free" && (
                    <a
                      href={cancelMailto(billing.plan)}
                      className="mt-4 text-center text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Request a downgrade / cancellation
                    </a>
                  )
                ) : (
                  <Button
                    variant={current ? "outline" : "default"}
                    size="sm"
                    className="mt-4"
                    onClick={() => setOpen(true)}
                  >
                    {current
                      ? p.id === "casual"
                        ? "Buy another pack"
                        : "Manage / change billing period"
                      : p.cta}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Checkout opens with all current prices. To switch between Organiser and Teams, or to
          cancel, email us and we'll update your subscription (you keep access until the end of the
          period you've paid for).
        </p>
      </Card>

      {pendingOrder && (
        <p className="rounded-xl border border-border bg-surface/60 p-4 text-sm text-foreground">
          Paid but your plan hasn't updated?{" "}
          <button
            type="button"
            onClick={() => void claimWithRetry(pendingOrder)}
            className="font-medium text-primary underline underline-offset-4"
          >
            Re-check my payment
          </button>
          . If it still doesn't update, make sure you paid with the same email address as your Klokk
          account, or email us.
        </p>
      )}

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
                  rememberOrder(order.orderId);
                  void claimWithRetry(order.orderId);
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
