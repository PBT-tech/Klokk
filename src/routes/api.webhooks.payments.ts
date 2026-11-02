// Payment events from HighLevel (a workflow posts here). Authenticated with a shared
// secret in the `x-klokk-secret` header. Body (JSON):
//   { "event": "order.paid" | "subscription.renewed" | "subscription.cancelled" | "payment.failed",
//     "orderId": "...", "email": "customer@example.com" }
// order.paid is re-verified against HighLevel before anything is granted.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env["PAYMENT_WEBHOOK_SECRET"];
  const given = request.headers.get("x-klokk-secret") ?? "";
  if (!secret || secret.length < 16 || !safeEqual(given, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const event = String(body.event ?? "");
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  if (!email) return new Response("Missing email", { status: 400 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db: any = supabaseAdmin;
  const { data: profile } = await db
    .from("profiles")
    .select("id, billing_interval")
    .eq("email", email)
    .maybeSingle();
  if (!profile) return Response.json({ ok: true, ignored: "no matching account" });

  if (event === "order.paid") {
    const { fetchPaidOrder, applyOrder } = await import("@/lib/klokk-billing.server");
    const order = await fetchPaidOrder(String(body.orderId ?? ""));
    if (order.email !== email) return new Response("Email mismatch", { status: 400 });
    await applyOrder(profile.id, order);
  } else if (event === "subscription.renewed") {
    const next = new Date();
    next.setMonth(next.getMonth() + (profile.billing_interval === "year" ? 12 : 1));
    await db
      .from("profiles")
      .update({ plan_renews_at: next.toISOString(), billing_status: "active" })
      .eq("id", profile.id);
  } else if (event === "subscription.cancelled") {
    await db.from("profiles").update({ billing_status: "cancelled" }).eq("id", profile.id);
  } else if (event === "payment.failed") {
    await db.from("profiles").update({ billing_status: "past_due" }).eq("id", profile.id);
  } else {
    return new Response("Unknown event", { status: 400 });
  }
  return Response.json({ ok: true });
}

export const Route = createFileRoute("/api/webhooks/payments")({
  server: { handlers: { POST: ({ request }) => handle(request) } },
});
