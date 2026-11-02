// Billing logic (server only): verify a HighLevel order, then grant what it bought.
// Nothing is granted on the strength of anything the browser says — the order is
// fetched from HighLevel with a server-held token and must be paid and belong to
// the signed-in user's email.

/* eslint-disable @typescript-eslint/no-explicit-any */

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

/** Grant what a verified, paid order bought, in one database transaction. Idempotent per order id. */
export async function applyOrder(userId: string, order: VerifiedOrder) {
  const db = await admin();
  const map = priceMap();
  // Merge repeat lines for the same price so quantities add up.
  const byPrice = new Map<string, number>();
  for (const l of order.lines) byPrice.set(l.priceId, (byPrice.get(l.priceId) ?? 0) + l.quantity);
  const grants: Record<string, unknown>[] = [];
  for (const [priceId, qty] of byPrice) {
    const g = map[priceId];
    if (g) grants.push({ ...g, priceId, qty });
  }
  if (grants.length === 0)
    throw new Error("That order does not contain a Klokk plan or credit pack.");

  const { data, error } = await db.rpc("apply_billing_order", {
    p_user: userId,
    p_order: order.orderId,
    p_grants: grants,
  });
  if (error) throw error;
  return { alreadyApplied: data === false };
}
