// Public participant server functions — NO auth required.
// Used by the participant response page (no account needed).
// Uses a publishable client (anon role, public RLS).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { mapEvent } from "./klokk-mapping";
import { sendSubmissionConfirmation } from "./klokk-email";
import type { KlokkEvent } from "./klokk-types";

const EVENT_SELECT = `
  *,
  time_slots ( id, date, start_time, end_time ),
  named_participants ( id, first_name, last_name, email, avatar_url ),
  participant_responses ( id, first_name, last_name, email, slot_ids, notes, avatar_url, submitted_at ),
  chat_messages ( id, author_name, author_email, is_organiser, text, pinned, created_at )
`;

function getClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Cloud not configured");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const getPublicEvent = createServerFn({ method: "GET" })
  .validator(z.object({ token: z.string() }))
  .handler(async ({ data }) => {
    const client = getClient();
    const { data: row, error } = await client
      .from("events")
      .select(EVENT_SELECT)
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    return mapEvent(row);
  });

export const submitResponse = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: z.string(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      slotIds: z.array(z.string()).min(1),
      notes: z.string().optional(),
      avatarUrl: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const client = getClient();
    const { data: event, error: evErr } = await client
      .from("events")
      .select(
        "id, owner_id, status, deadline, title, description, location, token, participation_mode, minimum_count",
      )
      .eq("token", data.token)
      .maybeSingle();
    if (evErr) throw evErr;
    if (!event) throw new Error("Event not found");
    if (event.status === "cancelled" || event.status === "closed") {
      throw new Error("This event is closed");
    }

    const { error } = await client.from("participant_responses").upsert(
      {
        event_id: event.id,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        slot_ids: data.slotIds,
        notes: data.notes?.trim() || null,
        avatar_url: data.avatarUrl ?? null,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "event_id,email" },
    );
    if (error) throw error;

    // F4/F7: send submission confirmation email to the participant.
    try {
      // Fetch organiser name for the email.
      const { data: owner } = await client
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", event.owner_id)
        .maybeSingle();
      const organiserName =
        owner && (owner.first_name || owner.last_name)
          ? `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim()
          : "Your organiser";
      const origin = typeof window !== "undefined" ? window.location.origin : "https://klokk.com";
      const fullEvent: KlokkEvent = {
        id: event.id,
        token: event.token,
        ownerId: event.owner_id,
        title: event.title,
        description: event.description ?? undefined,
        location: event.location ?? undefined,
        slots: [],
        participationMode: event.participation_mode,
        minimumCount: event.minimum_count ?? undefined,
        namedParticipants: [],
        responses: [],
        chat: [],
        status: event.status,
        deadline: event.deadline,
        createdAt: "",
      };
      sendSubmissionConfirmation({
        recipientEmail: data.email,
        recipientFirstName: data.firstName,
        recipientLastName: data.lastName,
        event: fullEvent,
        organiserName,
        origin,
      });
    } catch {
      /* email is best-effort — never block submission */
    }

    return { ok: true };
  });
