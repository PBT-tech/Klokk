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
import { participantWarning } from "./klokk-warnings";
import type { KlokkEvent, ParticipantResponse } from "./klokk-types";

// Explicit columns only: never owner_id, billing or internal fields.
const PUBLIC_EVENT_SELECT = `
  id, token, title, description, location, participation_mode, minimum_count, deadline, status,
  confirmed_slot_id, confirmed_custom_date, confirmed_custom_start, confirmed_custom_end,
  confirmed_at, created_at, closed_at,
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

async function clientIp(): Promise<string> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const h = getRequest().headers;
    return (
      h.get("cf-connecting-ip") ??
      h.get("x-real-ip") ??
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

/**
 * Persistent rate limit (database counter). Throws when the limit is exceeded. If the
 * limiter itself is unavailable it allows the request rather than taking the site down.
 */
async function rateLimit(key: string, max: number, windowSeconds: number): Promise<void> {
  try {
    const client = await admin();
    const { data, error } = await client.rpc("check_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (!error && data === false) {
      throw new Error("Too many requests. Please wait a few minutes and try again.");
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Too many requests")) throw e;
    console.error("[klokk] rate limiter unavailable:", e);
  }
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface ResolvedToken {
  eventToken: string;
  embedId: string | null;
}

/**
 * A participant presents either the event's secret link token, or an embed token
 * ("emb." prefix). An embed token only names an embed row; that row (not the token)
 * decides which event it grants, and it can be revoked or expire at any time.
 */
async function resolveToken(raw: string): Promise<ResolvedToken> {
  if (!raw.startsWith("emb.")) return { eventToken: raw, embedId: null };
  const { verifyEmbed } = await import("./klokk-embed.server");
  const payload = await verifyEmbed(raw);
  if (!payload) throw new Error("This embed link is not valid");
  await rateLimit(`embed:${payload.i}`, 200, 60);
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
    !r.events?.token
  ) {
    throw new Error("This embed link is no longer active");
  }
  return { eventToken: r.events.token, embedId: payload.i };
}

async function recordEmbedEvent(embedId: string | null, kind: "view" | "interaction" | "submit") {
  if (!embedId) return;
  const client = await admin();
  await client.from("embed_events").insert({ embed_id: embedId, kind });
}

/** Strip anything a participant must not see about other people. */
function toPublicEvent(row: any, embedded: boolean): KlokkEvent {
  const event = mapEvent({ ...row, owner_id: "", chat_messages: [] });
  return {
    ...event,
    // Embed viewers must never learn the event's secret link token.
    token: embedded ? "" : event.token,
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
    const viewIp = await clientIp();
    if (viewIp !== "unknown") await rateLimit(`view:${viewIp}`, 240, 60);
    const client = await admin();
    const { data: row, error } = await client
      .from("events")
      .select(PUBLIC_EVENT_SELECT)
      .eq("token", eventToken)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    await recordEmbedEvent(embedId, "view");
    return toPublicEvent(row, embedId !== null);
  });

/**
 * F4: a participant who re-opens the link on the device they used before sees which
 * times they chose. The browser presents the private edit code it was given when it
 * first submitted; knowing someone's email address is not enough.
 */
export const lookupMyResponse = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: z.string().min(8).max(600),
      email: z.string().email().max(254),
      editToken: z.string().min(20).max(100),
    }),
  )
  .handler(async ({ data }) => {
    const { eventToken } = await resolveToken(data.token);
    const lookupIp = await clientIp();
    if (lookupIp !== "unknown") await rateLimit(`lookup:${lookupIp}`, 60, 60);
    const client = await admin();
    const { data: event } = await client
      .from("events")
      .select("id")
      .eq("token", eventToken)
      .maybeSingle();
    if (!event) return null;
    const { data: row } = await client
      .from("participant_responses")
      .select("slot_ids, edit_token_hash")
      .eq("event_id", event.id)
      .eq("email", data.email.trim().toLowerCase())
      .maybeSingle();
    if (!row || !row.edit_token_hash) return null;
    if (row.edit_token_hash !== (await sha256Hex(data.editToken))) return null;
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
      /** private code from this browser's earlier submission, needed to change a response */
      editToken: z.string().min(20).max(100).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { eventToken, embedId } = await resolveToken(data.token);
    const ip = await clientIp();
    // If the host does not tell us the visitor's address, skip the per-address limit rather
    // than putting every visitor in one shared bucket; the per-event limit still applies.
    if (ip !== "unknown") await rateLimit(`submit:ip:${ip}`, 20, 600);
    await rateLimit(`submit:event:${eventToken}`, 300, 3600);
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
      .select("id, edit_token_hash")
      .eq("event_id", event.id)
      .eq("email", email)
      .maybeSingle();
    // Changing an existing response needs the private code issued to the original browser.
    if (existing?.edit_token_hash) {
      const ok = data.editToken && (await sha256Hex(data.editToken)) === existing.edit_token_hash;
      if (!ok) {
        throw new Error(
          "This email has already responded. Open the link on the device you used before, or ask the organiser to update your response.",
        );
      }
    }
    if (cap !== null && !existing) {
      const { count } = await client
        .from("participant_responses")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id);
      if ((count ?? 0) >= cap) {
        throw new Error(`This event has reached its participant limit (${cap}).`);
      }
    }

    // Only photos uploaded through our own server function are accepted as avatars.
    // Only photos uploaded through our own server function are accepted as avatars:
    // <project>/storage/v1/object/public/avatars/participants/<uuid>/<uuid>.<ext>
    const base = process.env["SUPABASE_URL"] ?? "";
    const avatarPattern = new RegExp(
      `^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/storage/v1/object/public/avatars/participants/` +
        `[0-9a-f-]{36}/[0-9a-f-]{36}\\.(png|jpg|gif|webp)$`,
    );
    const avatarUrl =
      base && data.avatarUrl && avatarPattern.test(data.avatarUrl) ? data.avatarUrl : null;

    const editToken =
      data.editToken ?? `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
    // When someone edits an earlier response, only overwrite phone, notes and photo if they
    // typed new ones (the edit form does not pre-fill them), so an edit never wipes them.
    const payload: Record<string, unknown> = {
      event_id: event.id,
      edit_token_hash: await sha256Hex(editToken),
      first_name: data.firstName.trim(),
      last_name: data.lastName.trim(),
      email,
      slot_ids: slotIds,
      submitted_at: new Date().toISOString(),
    };
    const newPhone = data.phone || null;
    const newNotes = data.notes?.trim() || null;
    if (!existing || newPhone) payload["phone"] = newPhone;
    if (!existing || newNotes) payload["notes"] = newNotes;
    if (!existing || avatarUrl) payload["avatar_url"] = avatarUrl;
    const { error } = await client
      .from("participant_responses")
      .upsert(payload, { onConflict: "event_id,email" });
    if (error) throw error;

    await recordEmbedEvent(embedId, "submit");

    // Warn the organiser (email, once per level) as the event nears or passes its limit.
    try {
      const { count: total } = await client
        .from("participant_responses")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id);
      if (owner?.plan === "casual") {
        const { recordOveragePending } = await import("./klokk-notify.server");
        await recordOveragePending({
          eventId: event.id,
          userId: event.owner_id,
          title: event.title,
          participants: total ?? 0,
        });
      }
      const warning = participantWarning(owner?.plan, total ?? 0, event.title);
      if (warning) {
        const { maybeSendWarning } = await import("./klokk-notify.server");
        await maybeSendWarning({ userId: event.owner_id, eventId: event.id, warning });
      }
    } catch {
      /* warnings are best-effort */
    }

    // F4/F7: submission confirmation email, sent once per participant per event
    // (best-effort, never blocks). Edits do not re-send it.
    if (!existing)
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
        await sendSubmissionConfirmation({
          recipientEmail: email,
          recipientFirstName: data.firstName,
          recipientLastName: data.lastName,
          event: fullEvent,
          organiserName,
          origin: await (await import("./klokk-origin.server")).appOrigin(),
        });
      } catch {
        /* email is best-effort — never block submission */
      }

    return { ok: true, editToken };
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
    const avatarIp = await clientIp();
    if (avatarIp !== "unknown") await rateLimit(`avatar:ip:${avatarIp}`, 10, 3600);
    await rateLimit(`avatar:event:${eventToken}`, 150, 3600);
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
    // WebP is a RIFF container: also require the "WEBP" form type (not WAV/AVI).
    if (
      data.contentType === "image/webp" &&
      new TextDecoder().decode(bytes.slice(8, 12)) !== "WEBP"
    ) {
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
