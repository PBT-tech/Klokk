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

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function run(request: Request): Promise<Response> {
  const secret = process.env["CRON_SECRET"];
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || secret.length < 16 || !safeEqual(given, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const origin = process.env["APP_ORIGIN"] ?? "https://klokk.com";
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
    for (const p of event.namedParticipants) {
      if (responded.has(p.email.toLowerCase())) continue;
      sendReminder({
        recipientEmail: p.email,
        recipientFirstName: p.firstName,
        recipientLastName: p.lastName,
        event,
        organiserName,
        origin,
      });
      summary.reminded++;
    }
    await (db as any)
      .from("events")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  // 1 & 3. Expiry and retention purge.
  const { data: expired } = await (db as any).rpc("expire_overdue_events");
  const { data: purged } = await (db as any).rpc("purge_expired_events");
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
