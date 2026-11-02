// Public participant server functions — NO login required.
// Participants are identified only by the event's secret token. These run on
// the server with the service role and always filter by token, so the database
// itself exposes nothing to the anon role. Nothing here ever returns another
// participant's email address or notes.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { mapEvent } from "./klokk-mapping";
import { sendSubmissionConfirmation } from "./klokk-email";
import { participantCapForPlan } from "./klokk-limits";
import type { KlokkEvent, ParticipantResponse } from "./klokk-types";

const PUBLIC_EVENT_SELECT = `
  *,
  time_slots ( id, date, start_time, end_time ),
  named_participants ( id, first_name, last_name, avatar_url ),
  participant_responses ( id, slot_ids, submitted_at )
`;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Strip anything a participant must not see about other people. */
function toPublicEvent(row: any): KlokkEvent {
  const event = mapEvent({ ...row, chat_messages: [] });
  return {
    ...event,
    // Named participants: names only, never emails.
    namedParticipants: event.namedParticipants.map((p) => ({ ...p, email: "" })),
    // Responses: slot selections only (used for the availability counts).
    responses: event.responses.map((r): ParticipantResponse => ({
      id: r.id,
      firstName: "",
      lastName: "",
      email: "",
      slotIds: r.slotIds,
      submittedAt: r.submittedAt,
    })),
  };
}

export const getPublicEvent = createServerFn({ method: "GET" })
  .validator(z.object({ token: z.string().min(8).max(64) }))
  .handler(async ({ data }) => {
    const client = await admin();
    const { data: row, error } = await client
      .from("events")
      .select(PUBLIC_EVENT_SELECT)
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    return toPublicEvent(row);
  });

/**
 * F4: a participant who re-opens the link with the same email sees which times
 * they chose before. Exact (lowercased) match only, and only slot selections are
 * returned — never names, notes or avatars — so knowing someone's email does not
 * reveal anything beyond which slots were ticked.
 */
export const lookupMyResponse = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().min(8).max(64), email: z.string().email().max(254) }))
  .handler(async ({ data }) => {
    const client = await admin();
    const { data: event } = await client
      .from("events")
      .select("id")
      .eq("token", data.token)
      .maybeSingle();
    if (!event) return null;
    const { data: row } = await client
      .from("participant_responses")
      .select("slot_ids")
      .eq("event_id", event.id)
      .eq("email", data.email.trim().toLowerCase())
      .maybeSingle();
    if (!row) return null;
    return { slotIds: (row.slot_ids ?? []) as string[] };
  });

export const submitResponse = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: z.string().min(8).max(64),
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
      email: z.string().email().max(254),
      slotIds: z.array(z.string()).min(1).max(500),
      notes: z.string().max(1000).optional(),
      avatarUrl: z.string().max(2000).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const client = await admin();
    const email = data.email.trim().toLowerCase();

    const { data: event, error: evErr } = await client
      .from("events")
      .select(
        "id, owner_id, status, deadline, title, description, location, token, participation_mode, minimum_count, time_slots ( id )",
      )
      .eq("token", data.token)
      .maybeSingle();
    if (evErr) throw evErr;
    if (!event) throw new Error("Event not found");
    if (event.status === "cancelled" || event.status === "closed" || event.status === "confirmed") {
      throw new Error("This event is closed");
    }
    if (new Date(event.deadline).getTime() < Date.now()) {
      throw new Error("The response deadline for this event has passed");
    }

    // Only accept slots that belong to this event.
    const validSlots = new Set(((event as any).time_slots ?? []).map((s: any) => s.id as string));
    const slotIds = data.slotIds.filter((id) => validSlots.has(id));
    if (slotIds.length === 0) throw new Error("Select at least one valid time");

    // Server-side participant cap (the database trigger enforces the same rule).
    const { data: owner } = await client
      .from("profiles")
      .select("plan, first_name, last_name")
      .eq("id", event.owner_id)
      .maybeSingle();
    const cap = participantCapForPlan(owner?.plan);
    const { data: existing } = await client
      .from("participant_responses")
      .select("id")
      .eq("event_id", event.id)
      .eq("email", email)
      .maybeSingle();
    if (cap !== null && !existing) {
      const { count } = await client
        .from("participant_responses")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id);
      if ((count ?? 0) >= cap) {
        throw new Error(`This event has reached its participant limit (${cap}).`);
      }
    }

    const { error } = await client.from("participant_responses").upsert(
      {
        event_id: event.id,
        first_name: data.firstName.trim(),
        last_name: data.lastName.trim(),
        email,
        slot_ids: slotIds,
        notes: data.notes?.trim() || null,
        avatar_url: data.avatarUrl ?? null,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "event_id,email" },
    );
    if (error) throw error;

    // F4/F7: submission confirmation email (best-effort, never blocks).
    try {
      const organiserName =
        owner && (owner.first_name || owner.last_name)
          ? `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim()
          : "Your organiser";
      const fullEvent: KlokkEvent = mapEvent({
        ...event,
        time_slots: [],
        named_participants: [],
        participant_responses: [],
        chat_messages: [],
        created_at: "",
      });
      sendSubmissionConfirmation({
        recipientEmail: email,
        recipientFirstName: data.firstName,
        recipientLastName: data.lastName,
        event: fullEvent,
        organiserName,
        origin: process.env["APP_ORIGIN"] ?? "https://klokk.com",
      });
    } catch {
      /* email is best-effort — never block submission */
    }

    return { ok: true };
  });
