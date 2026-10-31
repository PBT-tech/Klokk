// Pure DB-row → UI-type mappers. No secrets, safe for client and server.

import {
  DEFAULT_EMBED_SETTINGS,
  DEFAULT_NOTIFICATION_PREFS,
  type ChatMessage,
  type KlokkAccount,
  type KlokkEvent,
  type NamedParticipant,
  type ParticipantResponse,
  type SmsUsageEntry,
  type TimeSlot,
} from "./klokk-types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function mapSlot(r: any): TimeSlot {
  return { id: r.id, date: r.date, startTime: r.start_time, endTime: r.end_time };
}

export function mapNamed(r: any): NamedParticipant {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    avatarUrl: r.avatar_url ?? undefined,
  };
}

export function mapResponse(r: any): ParticipantResponse {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    slotIds: r.slot_ids ?? [],
    notes: r.notes ?? undefined,
    avatarUrl: r.avatar_url ?? undefined,
    submittedAt: r.submitted_at,
  };
}

export function mapChat(r: any): ChatMessage {
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

export function mapEvent(row: any): KlokkEvent {
  return {
    id: row.id,
    token: row.token,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    slots: (row.time_slots ?? []).map(mapSlot),
    participationMode: row.participation_mode,
    minimumCount: row.minimum_count ?? undefined,
    namedParticipants: (row.named_participants ?? []).map(mapNamed),
    deadline: row.deadline,
    responses: (row.participant_responses ?? []).map(mapResponse),
    chat: (row.chat_messages ?? []).map(mapChat),
    status: row.status,
    confirmedSlotId: row.confirmed_slot_id ?? undefined,
    confirmedAt: row.confirmed_at ?? undefined,
    createdAt: row.created_at,
    closedAt: row.closed_at ?? undefined,
  };
}

export function mapSmsUsage(r: any): SmsUsageEntry {
  return {
    id: r.id,
    date: r.date,
    recipient: r.recipient,
    eventId: r.event_id ?? "",
    eventTitle: r.event_title ?? "",
    type: r.type,
    credits: r.credits,
  };
}

/**
 * SMS credits included with a plan, as a percentage of the plan fee.
 * Free accounts get none; Casual 10%, Organiser 15%, Teams 20% of their fee.
 * (Computed from each plan's standard price; rounded to whole credits.)
 */
export function includedSmsCreditsForPlan(plan: string | null | undefined): number {
  switch (plan) {
    case "casual":
      return 3; // 10% of $25 ≈ 2.5 → 3
    case "organiser":
      return 3; // 15% of $17 ≈ 2.55 → 3
    case "teams":
      return 7; // 20% of $35 = 7
    default:
      return 0; // free (and any unknown plan) — no included credits
  }
}

export function mapProfile(row: any, usage: any[]): KlokkAccount {
  const plan = row.plan ?? "free";
  return {
    id: row.id,
    email: row.email ?? "",
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    avatarUrl: row.avatar_url ?? undefined,
    emailVerified: row.email_verified ?? false,
    createdAt: row.created_at,
    plan,
    // Free accounts get no included SMS credits. Paid plans get their
    // fee-percentage worth; any credits already on the row (e.g. purchased
    // top-ups) take precedence over the computed default.
    smsCredits: plan === "free" ? 0 : (row.sms_credits ?? includedSmsCreditsForPlan(plan)),
    smsAutoTopUp: row.sms_auto_top_up ?? false,
    smsLowBalanceThreshold: row.sms_low_balance_threshold ?? 50,
    smsUsageLog: (usage ?? []).map(mapSmsUsage),
    notificationPrefs: row.notification_prefs ?? DEFAULT_NOTIFICATION_PREFS,
    embedSettings: row.embed_settings ?? DEFAULT_EMBED_SETTINGS,
  };
}
