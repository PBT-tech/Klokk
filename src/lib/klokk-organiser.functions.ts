// Organiser server functions — protected by requireSupabaseAuth (RLS-scoped
// to the signed-in organiser). Used for dashboard, event management, settings.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mapEvent, mapProfile } from "./klokk-mapping";
import { makeToken } from "./klokk-store";
import {
  sendMeetingConfirmation,
  sendCancellation,
  sendReminder,
  sendInvitation,
} from "./klokk-email";
import type { ChatMessage, KlokkEvent, NamedParticipant, TimeSlot } from "./klokk-types";

const EVENT_SELECT = `
  *,
  time_slots ( id, date, start_time, end_time ),
  named_participants ( id, first_name, last_name, email, avatar_url ),
  participant_responses ( id, first_name, last_name, email, slot_ids, notes, avatar_url, submitted_at ),
  chat_messages ( id, author_name, author_email, is_organiser, text, pinned, created_at )
`;

function mapChat(r: any): ChatMessage {
  return {
    id: r.id,
    authorName: r.author_name,
    authorEmail: r.author_email ?? undefined,
    isOrganiser: r.is_organiser,
    text: r.text,
    pinned: r.pinned,
    createdAt: r.created_at,
  };
}

// ---------- profile ----------

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    let row = profile;
    if (!row) {
      const { data: user } = await supabase.auth.getUser();
      const email = user?.user?.email ?? "";
      const { data: created, error: insErr } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          email,
          first_name: "",
          last_name: "",
          email_verified: !!user?.user?.email_confirmed_at,
        })
        .select("*")
        .single();
      if (insErr) throw insErr;
      row = created;
    }
    const { data: usage } = await supabase
      .from("sms_usage")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(50);
    return mapProfile(row, usage ?? []);
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      email: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      avatarUrl: z.string().nullable().optional(),
      smsCredits: z.number().optional(),
      smsAutoTopUp: z.boolean().optional(),
      smsLowBalanceThreshold: z.number().optional(),
      notificationPrefs: z.any().optional(),
      embedSettings: z.any().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {};
    if (data.email !== undefined) patch["email"] = data.email;
    if (data.firstName !== undefined) patch["first_name"] = data.firstName;
    if (data.lastName !== undefined) patch["last_name"] = data.lastName;
    if (data.avatarUrl !== undefined) patch["avatar_url"] = data.avatarUrl;
    if (data.smsCredits !== undefined) patch["sms_credits"] = data.smsCredits;
    if (data.smsAutoTopUp !== undefined) patch["sms_auto_top_up"] = data.smsAutoTopUp;
    if (data.smsLowBalanceThreshold !== undefined)
      patch["sms_low_balance_threshold"] = data.smsLowBalanceThreshold;
    if (data.notificationPrefs !== undefined) patch["notification_prefs"] = data.notificationPrefs;
    if (data.embedSettings !== undefined) patch["embed_settings"] = data.embedSettings;
    const { error } = await supabase
      .from("profiles")
      .update(patch as any)
      .eq("id", userId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- events ----------

export const getMyEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("events")
      .select(EVENT_SELECT)
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapEvent);
  });

export const getMyEvent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("events")
      .select(EVENT_SELECT)
      .eq("id", data.id)
      .eq("owner_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    return mapEvent(row);
  });

const slotSchema = z.object({
  id: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
});
const namedSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().optional(),
});

export const createMyEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      location: z.string().optional(),
      participationMode: z.enum(["minimum", "named"]),
      minimumCount: z.number().optional(),
      deadline: z.string(),
      slots: z.array(slotSchema),
      namedParticipants: z.array(namedSchema),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const token = makeToken();
    const { data: event, error } = await supabase
      .from("events")
      .insert({
        token,
        owner_id: userId,
        title: data.title,
        description: data.description ?? null,
        location: data.location ?? null,
        participation_mode: data.participationMode,
        minimum_count: data.participationMode === "minimum" ? (data.minimumCount ?? 1) : null,
        deadline: data.deadline,
        status: "awaiting_responses",
      })
      .select("*")
      .single();
    if (error) throw error;

    const eventId = event.id;

    if (data.slots.length > 0) {
      const { error: sErr } = await supabase.from("time_slots").insert(
        data.slots.map((s: TimeSlot) => ({
          id: s.id,
          event_id: eventId,
          date: s.date,
          start_time: s.startTime,
          end_time: s.endTime,
        })),
      );
      if (sErr) throw sErr;
    }

    if (data.participationMode === "named" && data.namedParticipants.length > 0) {
      const { error: nErr } = await supabase.from("named_participants").insert(
        data.namedParticipants.map((p) => ({
          id: p.id,
          event_id: eventId,
          first_name: p.firstName,
          last_name: p.lastName,
          email: p.email,
          avatar_url: p.avatarUrl ?? null,
        })),
      );
      if (nErr) throw nErr;
    }

    const { data: full } = await supabase
      .from("events")
      .select(EVENT_SELECT)
      .eq("id", eventId)
      .single();

    // F3: send invitation emails to named participants on creation.
    if (data.participationMode === "named" && data.namedParticipants.length > 0) {
      try {
        const mapped: KlokkEvent = mapEvent(full ?? event);
        const { data: owner } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", userId)
          .maybeSingle();
        const organiserName =
          owner && (owner.first_name || owner.last_name)
            ? `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim()
            : "Your organiser";
        const origin = typeof window !== "undefined" ? window.location.origin : "https://klokk.com";
        for (const p of mapped.namedParticipants) {
          sendInvitation({
            recipientEmail: p.email,
            recipientFirstName: p.firstName,
            recipientLastName: p.lastName,
            event: mapped,
            organiserName,
            origin,
          });
        }
      } catch {
        /* invitations are best-effort */
      }
    }

    return mapEvent(full ?? event);
  });

export const updateMyEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      id: z.string(),
      status: z
        .enum([
          "awaiting_responses",
          "ready_to_confirm",
          "confirmed",
          "expired",
          "cancelled",
          "closed",
        ])
        .optional(),
      confirmedSlotId: z.string().nullable().optional(),
      confirmedAt: z.string().nullable().optional(),
      deadline: z.string().optional(),
      closedAt: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {};
    if (data.status !== undefined) patch["status"] = data.status;
    if (data.confirmedSlotId !== undefined) patch["confirmed_slot_id"] = data.confirmedSlotId;
    if (data.confirmedAt !== undefined) patch["confirmed_at"] = data.confirmedAt;
    if (data.deadline !== undefined) patch["deadline"] = data.deadline;
    if (data.closedAt !== undefined) patch["closed_at"] = data.closedAt;
    const { data: row, error } = await supabase
      .from("events")
      .update(patch as any)
      .eq("id", data.id)
      .eq("owner_id", userId)
      .select(EVENT_SELECT)
      .single();
    if (error) throw error;
    const event: KlokkEvent = mapEvent(row);

    // F6/F7/F9: trigger branded emails on confirm / cancel.
    try {
      const { data: owner } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", userId)
        .maybeSingle();
      const organiserName =
        owner && (owner.first_name || owner.last_name)
          ? `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim()
          : "Your organiser";
      const origin = typeof window !== "undefined" ? window.location.origin : "https://klokk.com";

      if (data.status === "confirmed") {
        // Notify every participant who responded (and named participants who didn't).
        const recipients = new Map<string, { first: string; last: string }>();
        for (const r of event.responses) {
          recipients.set(r.email.toLowerCase(), { first: r.firstName, last: r.lastName });
        }
        for (const n of event.namedParticipants) {
          if (!recipients.has(n.email.toLowerCase())) {
            recipients.set(n.email.toLowerCase(), { first: n.firstName, last: n.lastName });
          }
        }
        for (const [email, { first, last }] of recipients) {
          sendMeetingConfirmation({
            recipientEmail: email,
            recipientFirstName: first,
            recipientLastName: last,
            event,
            organiserName,
            origin,
          });
        }
      } else if (data.status === "cancelled") {
        const recipients = new Map<string, { first: string; last: string }>();
        for (const r of event.responses) {
          recipients.set(r.email.toLowerCase(), { first: r.firstName, last: r.lastName });
        }
        for (const n of event.namedParticipants) {
          if (!recipients.has(n.email.toLowerCase())) {
            recipients.set(n.email.toLowerCase(), { first: n.firstName, last: n.lastName });
          }
        }
        for (const [email, { first, last }] of recipients) {
          sendCancellation({
            recipientEmail: email,
            recipientFirstName: first,
            recipientLastName: last,
            event,
            organiserName,
            origin,
          });
        }
      }
    } catch {
      /* notifications are best-effort */
    }

    return event;
  });

export const deleteMyEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const addChatMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      eventId: z.string(),
      authorName: z.string(),
      authorEmail: z.string().optional(),
      text: z.string().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ev, error: evErr } = await supabase
      .from("events")
      .select("id")
      .eq("id", data.eventId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (evErr) throw evErr;
    if (!ev) throw new Error("Event not found");
    const { data: row, error } = await supabase
      .from("chat_messages")
      .insert({
        event_id: data.eventId,
        author_name: data.authorName,
        author_email: data.authorEmail ?? null,
        is_organiser: true,
        text: data.text,
        pinned: false,
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapChat(row);
  });

export const togglePinFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ eventId: z.string(), messageId: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ev, error: evErr } = await supabase
      .from("events")
      .select("id")
      .eq("id", data.eventId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (evErr) throw evErr;
    if (!ev) throw new Error("Event not found");
    const { data: msg, error } = await supabase
      .from("chat_messages")
      .select("pinned")
      .eq("id", data.messageId)
      .eq("event_id", data.eventId)
      .maybeSingle();
    if (error) throw error;
    if (!msg) throw new Error("Message not found");
    const pinnedCount = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("event_id", data.eventId)
      .eq("pinned", true);
    if (pinnedCount.error) throw pinnedCount.error;
    if (!msg.pinned && (pinnedCount.count ?? 0) >= 3) {
      throw new Error("Maximum of 3 pinned messages");
    }
    const { data: updated, error: upErr } = await supabase
      .from("chat_messages")
      .update({ pinned: !msg.pinned })
      .eq("id", data.messageId)
      .select("*")
      .single();
    if (upErr) throw upErr;
    return mapChat(updated);
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").delete().eq("id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const updateNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ prefs: z.any() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ notification_prefs: data.prefs })
      .eq("id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const updateEmbedSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ settings: z.any() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ embed_settings: data.settings })
      .eq("id", userId);
    if (error) throw error;
    return { ok: true };
  });

// F3: send invitation emails to named participants on event creation.
export const sendInvitationsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ eventId: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("events")
      .select(EVENT_SELECT)
      .eq("id", data.eventId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Event not found");
    const event: KlokkEvent = mapEvent(row);
    if (event.participationMode !== "named" || event.namedParticipants.length === 0) {
      return { sent: 0 };
    }
    const { data: owner } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", userId)
      .maybeSingle();
    const organiserName =
      owner && (owner.first_name || owner.last_name)
        ? `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim()
        : "Your organiser";
    const origin = typeof window !== "undefined" ? window.location.origin : "https://klokk.com";
    let sent = 0;
    for (const p of event.namedParticipants) {
      try {
        sendInvitation({
          recipientEmail: p.email,
          recipientFirstName: p.firstName,
          recipientLastName: p.lastName,
          event,
          organiserName,
          origin,
        });
        sent++;
      } catch {
        /* best-effort */
      }
    }
    return { sent };
  });

// F7: reminder to outstanding named participants (organiser-triggered).
export const sendReminderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ eventId: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("events")
      .select(EVENT_SELECT)
      .eq("id", data.eventId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Event not found");
    const event: KlokkEvent = mapEvent(row);
    if (event.participationMode !== "named") {
      return { sent: 0 };
    }
    const respondedEmails = new Set(event.responses.map((r) => r.email.toLowerCase()));
    const outstanding = event.namedParticipants.filter(
      (p) => !respondedEmails.has(p.email.toLowerCase()),
    );
    if (outstanding.length === 0) return { sent: 0 };
    const { data: owner } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", userId)
      .maybeSingle();
    const organiserName =
      owner && (owner.first_name || owner.last_name)
        ? `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim()
        : "Your organiser";
    const origin = typeof window !== "undefined" ? window.location.origin : "https://klokk.com";
    let sent = 0;
    for (const p of outstanding) {
      try {
        sendReminder({
          recipientEmail: p.email,
          recipientFirstName: p.firstName,
          recipientLastName: p.lastName,
          event,
          organiserName,
          origin,
        });
        sent++;
      } catch {
        /* best-effort */
      }
    }
    return { sent };
  });
