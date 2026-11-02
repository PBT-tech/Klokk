// Klokk domain types — shared across the app.

export type EventStatus =
  "awaiting_responses" | "ready_to_confirm" | "confirmed" | "expired" | "cancelled" | "closed";

export type ParticipationMode = "minimum" | "named";

export interface TimeSlot {
  id: string;
  /** ISO date string (yyyy-MM-dd) */
  date: string;
  /** 24h "HH:mm" */
  startTime: string;
  /** 24h "HH:mm" */
  endTime: string;
}

export interface NamedParticipant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | undefined;
}

export interface ParticipantResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | undefined;
  /** slot ids the participant marked available */
  slotIds: string[];
  notes?: string | undefined;
  avatarUrl?: string | undefined;
  submittedAt: string; // ISO
}

export interface ChatMessage {
  id: string;
  authorName: string;
  authorEmail?: string;
  isOrganiser: boolean;
  text: string;
  pinned: boolean;
  createdAt: string; // ISO
}

export interface KlokkEvent {
  id: string;
  token: string;
  ownerId: string;
  title: string;
  description?: string;
  location?: string;
  slots: TimeSlot[];
  participationMode: ParticipationMode;
  minimumCount?: number;
  namedParticipants: NamedParticipant[];
  deadline: string; // ISO
  responses: ParticipantResponse[];
  chat: ChatMessage[];
  status: EventStatus;
  confirmedSlotId?: string;
  /** Organiser-entered meeting time that is not one of the proposed slots. */
  confirmedCustom?: { date: string; startTime: string; endTime: string };
  confirmedAt?: string;
  createdAt: string; // ISO
  closedAt?: string;
}

export type KlokkPlanTier = "free" | "casual" | "organiser" | "teams";

export interface KlokkAccount {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  emailVerified: boolean;
  createdAt: string;
  plan: KlokkPlanTier;
  smsCredits: number;
  smsAutoTopUp: boolean;
  smsLowBalanceThreshold: number;
  smsUsageLog: SmsUsageEntry[];
  notificationPrefs: NotificationPrefs;
  embedSettings: EmbedSettings;
}

export interface SmsUsageEntry {
  id: string;
  date: string;
  recipient: string; // masked
  eventId: string;
  eventTitle: string;
  type: "invitation" | "reminder" | "confirmation";
  credits: number;
}

export interface NotificationPrefs {
  eventUpdates: { email: boolean; sms: boolean };
  reminders: { email: boolean; sms: boolean };
  chatMessages: { email: boolean; sms: boolean };
}

export interface EmbedSettings {
  accentOverride: string;
  domainAllowlist: string[];
  embedExpiry: string;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  eventUpdates: { email: true, sms: false },
  reminders: { email: true, sms: false },
  chatMessages: { email: true, sms: false },
};

export const DEFAULT_EMBED_SETTINGS: EmbedSettings = {
  accentOverride: "#c9a84c",
  domainAllowlist: [],
  embedExpiry: "",
};
