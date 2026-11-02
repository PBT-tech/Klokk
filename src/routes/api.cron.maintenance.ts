// Scheduled maintenance. Call with `POST /api/cron/maintenance` and the header
// `Authorization: Bearer <CRON_SECRET>` from any scheduler (HighLevel workflow,
// GitHub Actions, cron-job.org). It:
//   1. marks events past their deadline as expired,
//   2. sends the automatic 24-hour reminder to named participants who have not responded,
//   3. purges events past their retention period (also scheduled in-database by pg_cron).
// Running it more often than needed is safe: every step is idempotent.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { mapEvent } from "@/lib/klokk-mapping";
import { sendReminder } from "@/lib/klokk-email";
import { eventsWarning } from "@/lib/klokk-warnings";

/** Constant-time comparison of SHA-256 digests, so neither content nor length leaks. */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

async function run(request: Request): Promise<Response> {
  const secret = process.env["CRON_SECRET"];
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || secret.length < 32 || !(await safeEqual(given, secret))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const origin = await (await import("@/lib/klokk-origin.server")).appOrigin();
  const summary = { reminded: 0, expired: 0, purged: 0 };

  // 2. Automatic reminders: deadline within the next 24 hours, not reminded yet.
  const soon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: due } = await db
    .from("events")
    .select(
      `*, time_slots ( id, date, start_time, end_time ),
       named_participants ( id, first_name, last_name, email, avatar_url ),
       participant_responses ( id, first_name, last_name, email, slot_ids, notes, avatar_url, submitted_at )`,
    )
    .in("status", ["awaiting_responses", "ready_to_confirm"])
    .eq("participation_mode", "named")
    .is("reminder_sent_at", null)
    .gt("deadline", new Date().toISOString())
    .lte("deadline", soon);

  for (const row of (due ?? []) as any[]) {
    const event = mapEvent({ ...row, chat_messages: [] });
    const responded = new Set(event.responses.map((r) => r.email.toLowerCase()));
    const { data: owner } = await db
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", event.ownerId)
      .maybeSingle();
    const organiserName =
      owner && (owner.first_name || owner.last_name)
        ? `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim()
        : "Your organiser";
    let allSent = true;
    for (const p of event.namedParticipants) {
      if (responded.has(p.email.toLowerCase())) continue;
      const ok = await sendReminder({
        recipientEmail: p.email,
        recipientFirstName: p.firstName,
        recipientLastName: p.lastName,
        event,
        organiserName,
        origin,
      });
      if (ok) summary.reminded++;
      else allSent = false;
    }
    // A dropped send is retried on the next run: only mark the event once all went out.
    if (allSent) {
      await (db as any)
        .from("events")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  }

  // 1 & 3. Expiry and retention purge.
  const { data: expired } = await (db as any).rpc("expire_overdue_events");
  const { data: purged } = await (db as any).rpc("purge_expired_events");
  // Safety net: invoice overage records whose events have finished (or were deleted).
  await (await import("@/lib/klokk-notify.server")).invoicePendingOverages();
  await (db as any).rpc("purge_rate_limits");

  // Free plan: tell organisers 14 days before an event's data is deleted (day 76 of 90).
  const { data: aging } = await (db as any)
    .from("events")
    .select("id, title, owner_id, created_at")
    .lt("created_at", new Date(Date.now() - 76 * 86_400_000).toISOString())
    .gt("created_at", new Date(Date.now() - 90 * 86_400_000).toISOString());
  for (const ev of (aging ?? []) as any[]) {
    const { data: o } = await (db as any)
      .from("profiles")
      .select("plan")
      .eq("id", ev.owner_id)
      .maybeSingle();
    if (o?.plan !== "free") continue;
    const deleteOn = new Date(new Date(ev.created_at).getTime() + 90 * 86_400_000);
    const { maybeSendWarning } = await import("@/lib/klokk-notify.server");
    await maybeSendWarning({
      userId: ev.owner_id,
      eventId: ev.id,
      warning: {
        kind: "retention_soon",
        level: "warn",
        title: `"${ev.title}" will be deleted on ${deleteOn.toLocaleDateString("en-AU")}`,
        lines: [
          `Events on the Free plan, with all their responses and participant details, are deleted automatically 90 days after they are created. This cannot be undone.`,
          `Paid plans keep event data for 12 months after the event closes.`,
          `Organiser is $17/month for unlimited events, or buy a credit pack from $25.`,
        ],
      },
    });
  }

  // Casual organisers: credits running low or a pack about to expire.
  const { data: casuals } = await (db as any).from("profiles").select("id").eq("plan", "casual");
  for (const c of (casuals ?? []) as { id: string }[]) {
    const { data: packs } = await (db as any)
      .from("event_credit_packs")
      .select("events_total, events_used, expires_at")
      .eq("user_id", c.id);
    const live = ((packs ?? []) as any[])
      .filter(
        (k) => k.events_used < k.events_total && new Date(k.expires_at).getTime() > Date.now(),
      )
      .sort((a, b) => a.expires_at.localeCompare(b.expires_at));
    const warning = eventsWarning({
      plan: "casual",
      eventsCreated: 0,
      creditsLeft: live.reduce((n, k) => n + (k.events_total - k.events_used), 0),
      nextExpiry: live[0]?.expires_at ?? null,
    });
    if (warning) {
      const { maybeSendWarning } = await import("@/lib/klokk-notify.server");
      // The period (the soonest expiry) lets the warning repeat after a new purchase.
      await maybeSendWarning({ userId: c.id, warning, period: live[0]?.expires_at ?? "none" });
    }
  }

  // Subscriptions that were cancelled (or never renewed) and whose paid period has ended.
  await (db as any)
    .from("profiles")
    .update({ plan: "free", billing_interval: null, billing_status: "active" })
    .in("plan", ["organiser", "teams"])
    .eq("billing_status", "cancelled")
    .lt("plan_renews_at", new Date().toISOString());
  summary.expired = typeof expired === "number" ? expired : 0;
  summary.purged = typeof purged === "number" ? purged : 0;

  return Response.json({ ok: true, ...summary });
}

export const Route = createFileRoute("/api/cron/maintenance")({
  server: {
    handlers: {
      POST: ({ request }) => run(request),
    },
  },
});
