// Billing logic (server only): verify a HighLevel order, then grant what it bought.
// Nothing is granted on the strength of anything the browser says — the order is
// fetched from HighLevel with a server-held token and must be paid and belong to
// the signed-in user's email.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { CASUAL_PACK_VALID_MONTHS } from "./klokk-limits";

export type PriceGrant =
  | { kind: "pack"; events: number }
  | { kind: "subscription"; plan: "organiser" | "teams"; interval: "month" | "year" }
  | { kind: "seat" };

/**
 * Maps HighLevel price ids to what they grant. BILLING_PRICE_MAP (JSON) can add to or override the defaults, e.g.
 * {"6a1...": {"kind":"pack","events":5}, "6a2...": {"kind":"subscription","plan":"organiser","interval":"month"}}
 */
export function priceMap(): Record<string, PriceGrant> {
  try {
    const raw = process.env["BILLING_PRICE_MAP"];
    return {
      ...DEFAULT_PRICE_MAP,
      ...(raw ? (JSON.parse(raw) as Record<string, PriceGrant>) : {}),
    };
  } catch {
    return { ...DEFAULT_PRICE_MAP };
  }
}

/**
 * The prices created in the Klokk HighLevel sub-account (AUD). Price ids are not secret.
 * Override or extend with BILLING_PRICE_MAP if prices are ever recreated.
 */
export const DEFAULT_PRICE_MAP: Record<string, PriceGrant> = {
  "6ae8727190f5beded44a566b": { kind: "pack", events: 5 },
  "6ae8727268a0b355ae0df038": { kind: "pack", events: 10 },
  "6ae8727366931dd9e8cf8bcd": { kind: "pack", events: 15 },
  "6ae87274de7d7c061ecece9e": { kind: "subscription", plan: "organiser", interval: "month" },
  "6ae8727697cd4e35cc5f21e4": { kind: "subscription", plan: "organiser", interval: "year" },
  "6ae87277965bf50b283f97a1": { kind: "subscription", plan: "teams", interval: "month" },
  "6ae872787d1cf14640e41a3d": { kind: "subscription", plan: "teams", interval: "year" },
  "6ae87279a04ac34e64b92013": { kind: "seat" },
  "6ae8727a965bf50b283f97d3": { kind: "seat" },
};

async function admin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface VerifiedOrder {
  orderId: string;
  email: string;
  lines: { priceId: string; quantity: number }[];
}

/** Fetch the order from HighLevel and confirm it is paid. Throws if it cannot be verified. */
export async function fetchPaidOrder(orderId: string): Promise<VerifiedOrder> {
  const token = process.env["HL_API_TOKEN"];
  const locationId = process.env["HL_LOCATION_ID"] ?? "0FNYpxrhqqIS9bIV2FDq";
  if (!token) throw new Error("Billing is not configured yet (HL_API_TOKEN).");
  const res = await fetch(
    `https://services.leadconnectorhq.com/payments/orders/${encodeURIComponent(orderId)}?locationId=${locationId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: "2021-07-28",
        Accept: "application/json",
      },
    },
  );
  if (!res.ok) throw new Error("We could not verify that order yet. Please try again in a minute.");
  const o: any = await res.json();
  const status = String(o.status ?? "").toLowerCase();
  const payStatus = String(o.paymentStatus ?? o.payment_status ?? "").toLowerCase();
  const paid =
    ["completed", "paid", "succeeded"].includes(status) ||
    ["paid", "succeeded", "completed"].includes(payStatus);
  if (!paid) throw new Error("That order has not been paid yet.");
  const items: any[] = o.items ?? o.lineItems ?? o.line_items ?? [];
  const lines = items
    .map((it) => ({
      priceId: String(it.price?._id ?? it.price?.id ?? it.priceId ?? it.price_id ?? ""),
      quantity: Number(it.qty ?? it.quantity ?? 1) || 1,
    }))
    .filter((l) => l.priceId);
  const email = String(o.contactEmail ?? o.contact?.email ?? o.email ?? "").toLowerCase();
  if (!email || lines.length === 0) throw new Error("That order could not be read.");
  return { orderId, email, lines };
}

function addMonths(d: Date, m: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
}

/** Grant what a verified, paid order bought. Idempotent per order id. */
export async function applyOrder(userId: string, order: VerifiedOrder) {
  const db = await admin();
  const map = priceMap();
  const grants = order.lines
    .map((l) => ({ line: l, grant: map[l.priceId] }))
    .filter((g): g is { line: (typeof order.lines)[number]; grant: PriceGrant } => !!g.grant);
  if (grants.length === 0)
    throw new Error("That order does not contain a Klokk plan or credit pack.");

  // Record the order first; the primary key makes a repeat claim a no-op.
  const { error: dupErr } = await db
    .from("billing_orders")
    .insert({ order_id: order.orderId, user_id: userId, summary: { lines: order.lines } });
  if (dupErr) {
    if (String(dupErr.code) === "23505") return { alreadyApplied: true };
    throw dupErr;
  }

  const now = new Date();
  for (const { line, grant } of grants) {
    if (grant.kind === "pack") {
      const { error } = await db.from("event_credit_packs").insert({
        user_id: userId,
        order_id: `${order.orderId}:${line.priceId}`,
        events_total: grant.events * line.quantity,
        purchased_at: now.toISOString(),
        expires_at: addMonths(now, CASUAL_PACK_VALID_MONTHS).toISOString(),
      });
      if (error) throw error;
      // A pack moves a Free account to Casual; it never downgrades a subscriber.
      await db.from("profiles").update({ plan: "casual" }).eq("id", userId).eq("plan", "free");
    } else if (grant.kind === "subscription") {
      const renews = grant.interval === "year" ? addMonths(now, 12) : addMonths(now, 1);
      const { error } = await db
        .from("profiles")
        .update({
          plan: grant.plan,
          billing_interval: grant.interval,
          plan_renews_at: renews.toISOString(),
          billing_status: "active",
        })
        .eq("id", userId);
      if (error) throw error;
    } else if (grant.kind === "seat") {
      const { data: p } = await db.from("profiles").select("extra_seats").eq("id", userId).single();
      await db
        .from("profiles")
        .update({ extra_seats: (p?.extra_seats ?? 0) + line.quantity })
        .eq("id", userId);
    }
  }
  return { alreadyApplied: false };
}
