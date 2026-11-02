// Billing server functions (signed-in organisers).

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface CreditPack {
  id: string;
  eventsTotal: number;
  eventsUsed: number;
  purchasedAt: string;
  expiresAt: string;
}

export interface BillingInfo {
  plan: "free" | "casual" | "organiser" | "teams";
  billingInterval: "month" | "year" | null;
  planRenewsAt: string | null;
  billingStatus: "active" | "past_due" | "cancelled";
  extraSeats: number;
  eventsCreated: number;
  packs: CreditPack[];
  /** events still available across packs that have not expired */
  creditsLeft: number;
  /** soonest expiry among packs that still have events left */
  nextExpiry: string | null;
}

export const getMyBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingInfo> => {
    const db = context.supabase as any;
    const { data: p, error } = await db
      .from("profiles")
      .select("plan, billing_interval, plan_renews_at, billing_status, extra_seats, events_created")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw error;
    const { data: packs } = await db
      .from("event_credit_packs")
      .select("id, events_total, events_used, purchased_at, expires_at")
      .eq("user_id", context.userId)
      .order("expires_at", { ascending: true });
    const list: CreditPack[] = (packs ?? []).map((r: any) => ({
      id: r.id,
      eventsTotal: r.events_total,
      eventsUsed: r.events_used,
      purchasedAt: r.purchased_at,
      expiresAt: r.expires_at,
    }));
    const live = list.filter(
      (k) => k.eventsUsed < k.eventsTotal && new Date(k.expiresAt).getTime() > Date.now(),
    );
    return {
      plan: p?.plan ?? "free",
      billingInterval: p?.billing_interval ?? null,
      planRenewsAt: p?.plan_renews_at ?? null,
      billingStatus: p?.billing_status ?? "active",
      extraSeats: p?.extra_seats ?? 0,
      eventsCreated: p?.events_created ?? 0,
      packs: list,
      creditsLeft: live.reduce((n, k) => n + (k.eventsTotal - k.eventsUsed), 0),
      nextExpiry: live[0]?.expiresAt ?? null,
    };
  });

/** Called after the checkout reports a paid order. The order is verified with HighLevel first. */
export const claimOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ orderId: z.string().min(4).max(100) }))
  .handler(async ({ data, context }) => {
    const { fetchPaidOrder, applyOrder } = await import("./klokk-billing.server");
    // Identity is the confirmed email on the sign-in account, never an editable profile field.
    const { data: auth } = await context.supabase.auth.getUser();
    const authEmail = auth?.user?.email?.toLowerCase();
    if (!authEmail || !auth.user?.email_confirmed_at) {
      throw new Error("Please verify your email address before buying a plan.");
    }
    const order = await fetchPaidOrder(data.orderId);
    if (order.email !== authEmail) {
      throw new Error("That order was placed with a different email address than your account.");
    }
    return applyOrder(context.userId, order);
  });
