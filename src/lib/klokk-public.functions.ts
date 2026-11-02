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

// Typed loosely on purpose: generated database types lag behind migrations until
// the Cloud project regenerates them.
async function admin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

interface ResolvedToken {
  eventToken: string;
  embedId: string | null;
}

/**
 * A participant presents either the event's secret link token, or an embed token
 * ("emb." prefix). Embed tokens are verified (signature, not revoked, not expired,
 * not rate limited) and mapped back to the event token they grant.
 */
async function resolveToken(raw: string): Promise<ResolvedToken> {
  if (!raw.startsWith("emb.")) return { eventToken: raw, embedId: null };
  const { verifyEmbed, embedRateLimited } = await import("./klokk-embed.server");
  const payload = await verifyEmbed(raw);
  if (!payload) throw new Error("This embed link is not valid");
  if (embedRateLimited(payload.i)) throw new Error("Too many requests. Please try again shortly.");
  const client = await admin();
  const { data: row } = await client
    .from("embed_tokens")
    .select("id, revoked_at, expires_at, events ( token )")
    .eq("id", payload.i)
    .maybeSingle();
  const r = row as {
    revoked_at: string | null;
    expires_at: string | null;
    events: { token: string } | null;
  } | null;
  if (
    !r ||
    r.revoked_at ||
    (r.expires_at && new Date(r.expires_at).getTime() < Date.now()) ||
    r.events?.token !== payload.e
  ) {
    throw new Error("This embed link is no longer active");
  }
  return { eventToken: payload.e, embedId: payload.i };
}

async function recordEmbedEvent(embedId: string | null, kind: "view" | "interaction" | "submit") {
  if (!embedId) return;
  const client = await admin();
  await client.from("embed_events").insert({ embed_id: embedId, kind });
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
  .validator(z.object({ token: z.string().min(8).max(600) }))
  .handler(async ({ data }) => {
    const { eventToken, embedId } = await resolveToken(data.token);
    const client = await admin();
    const { data: row, error } = await client
      .from("events")
      .select(PUBLIC_EVENT_SELECT)
      .eq("token", eventToken)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    await recordEmbedEvent(embedId, "view");
    return toPublicEvent(row);
  });

/**
 * F4: a participant who re-opens the link with the same email sees which times
 * they chose before. Exact (lowercased) match only, and only slot selections are
 * returned — never names, notes or avatars — so knowing someone's email does not
 * reveal anything beyond which slots were ticked.
 */
export const lookupMyResponse = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().min(8).max(600), email: z.string().email().max(254) }))
  .handler(async ({ data }) => {
    const { eventToken } = await resolveToken(data.token);
    const client = await admin();
    const { data: event } = await client
      .from("events")
      .select("id")
      .eq("token", eventToken)
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
      token: z.string().min(8).max(600),
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
      email: z.string().email().max(254),
      phone: z
        .string()
        .trim()
        .regex(/^\+?[0-9 ()-]{6,20}$/, "Enter a valid phone number or leave it blank")
        .optional(),
      slotIds: z.array(z.string()).min(1).max(500),
      notes: z.string().max(1000).optional(),
      avatarUrl: z.string().max(2000).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { eventToken, embedId } = await resolveToken(data.token);
    const client = await admin();
    const email = data.email.trim().toLowerCase();

    const { data: event, error: evErr } = await client
      .from("events")
      .select(
        "id, owner_id, status, deadline, title, description, location, token, participation_mode, minimum_count, time_slots ( id )",
      )
      .eq("token", eventToken)
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
        phone: data.phone || null,
        slot_ids: slotIds,
        notes: data.notes?.trim() || null,
        avatar_url: data.avatarUrl ?? null,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "event_id,email" },
    );
    if (error) throw error;

    await recordEmbedEvent(embedId, "submit");

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

const AVATAR_TYPES: Record<string, { ext: string; magic: number[][] }> = {
  "image/png": { ext: "png", magic: [[0x89, 0x50, 0x4e, 0x47]] },
  "image/jpeg": { ext: "jpg", magic: [[0xff, 0xd8, 0xff]] },
  "image/gif": { ext: "gif", magic: [[0x47, 0x49, 0x46, 0x38]] },
  "image/webp": { ext: "webp", magic: [[0x52, 0x49, 0x46, 0x46]] },
};
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Participant photo upload. Runs on the server so the storage bucket never needs to
 * accept anonymous uploads: the event link is verified, the file type is checked
 * against an allow-list and its first bytes, and the size is capped.
 */
export const uploadParticipantAvatarFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: z.string().min(8).max(600),
      contentType: z.string().max(40),
      dataBase64: z.string().max(3_200_000),
    }),
  )
  .handler(async ({ data }) => {
    const { eventToken } = await resolveToken(data.token);
    const client = await admin();
    const { data: event } = await client
      .from("events")
      .select("id, status")
      .eq("token", eventToken)
      .maybeSingle();
    if (!event) throw new Error("Event not found");
    if (event.status === "cancelled" || event.status === "closed") {
      throw new Error("This event is closed");
    }
    const type = AVATAR_TYPES[data.contentType];
    if (!type) throw new Error("Use a PNG, JPEG, GIF or WebP image");
    const bytes = Uint8Array.from(atob(data.dataBase64), (c) => c.charCodeAt(0));
    if (bytes.length === 0 || bytes.length > AVATAR_MAX_BYTES) {
      throw new Error("Image must be 2 MB or smaller");
    }
    if (!type.magic.some((m) => m.every((b, i) => bytes[i] === b))) {
      throw new Error("That file does not look like a valid image");
    }
    const path = `participants/${event.id}/${crypto.randomUUID()}.${type.ext}`;
    const { error } = await client.storage.from("avatars").upload(path, bytes, {
      contentType: data.contentType,
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    const { data: pub } = client.storage.from("avatars").getPublicUrl(path);
    return { url: pub.publicUrl as string };
  });

/** Embed analytics: the widget reports that a participant interacted with it. */
export const reportEmbedInteraction = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().min(8).max(600) }))
  .handler(async ({ data }) => {
    if (!data.token.startsWith("emb.")) return { ok: false };
    const { embedId } = await resolveToken(data.token);
    await recordEmbedEvent(embedId, "interaction");
    return { ok: true };
  });

/**
 * Settings the embed page needs before it renders: which sites may frame it
 * (the organiser's domain allow-list) and the accent colour override.
 */
async function getEmbedFrameConfig(
  rawToken: string,
): Promise<{ frameAncestors: string; accent: string | null } | null> {
  if (!rawToken.startsWith("emb.")) return null;
  const { eventToken } = await resolveToken(rawToken);
  const client = await admin();
  const { data: ev } = await client
    .from("events")
    .select("owner_id")
    .eq("token", eventToken)
    .maybeSingle();
  if (!ev) return null;
  const { data: prof } = await client
    .from("profiles")
    .select("embed_settings")
    .eq("id", ev.owner_id)
    .maybeSingle();
  const settings = (prof?.embed_settings ?? {}) as {
    domainAllowlist?: string[];
    accentOverride?: string;
  };
  const hosts = (settings.domainAllowlist ?? [])
    .map((d) => d.trim().toLowerCase())
    .filter((d) => /^(\*\.)?[a-z0-9.-]+(:\d+)?$/.test(d))
    .map((d) => `https://${d}`);
  const accent =
    settings.accentOverride && /^#[0-9a-fA-F]{6}$/.test(settings.accentOverride)
      ? settings.accentOverride
      : null;
  // No allow-list means nobody may frame it: the organiser must opt in per domain.
  return { frameAncestors: hosts.length > 0 ? hosts.join(" ") : "'none'", accent };
}

export const getEmbedConfig = createServerFn({ method: "GET" })
  .validator(z.object({ token: z.string().min(8).max(600) }))
  .handler(async ({ data }) => getEmbedFrameConfig(data.token));
