// Pure helpers for the create-event flow. No React, no store — safe anywhere.

import type { NamedParticipant, ParticipationMode, TimeSlot } from "./klokk-types";
import { toISODate } from "./klokk-format";

export type Draft = {
  title: string;
  description: string;
  location: string;
  slots: TimeSlot[];
  participationMode: ParticipationMode;
  minimumCount: number;
  namedParticipants: NamedParticipant[];
  deadline: string; // ISO
};

export function emptyDraft(): Draft {
  return {
    title: "",
    description: "",
    location: "",
    slots: [],
    participationMode: "minimum",
    minimumCount: 5,
    namedParticipants: [],
    deadline: new Date(Date.now() + 86_400_000 * 3).toISOString(),
  };
}

export function sortSlots(slots: TimeSlot[]): TimeSlot[] {
  return [...slots].sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
  );
}

export function makeSlot(date: Date | undefined, start: string, end: string): TimeSlot | null {
  if (!date) return null;
  if (start >= end) return null;
  const iso = toISODate(date);
  return {
    id: `slot_${iso}_${start.replace(":", "")}_${end.replace(":", "")}`,
    date: iso,
    startTime: start,
    endTime: end,
  };
}

export function toLocalInput(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000;
  const local = new Date(d.getTime() - tz);
  return local.toISOString().slice(0, 16);
}

export const CREATE_STEPS = [
  "Details",
  "Time slots",
  "Participants",
  "Deadline",
  "Review",
] as const;
