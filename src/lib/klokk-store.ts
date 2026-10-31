// Klokk — pure helpers only (no localStorage, no Cloud calls).
// These are safe to import on both client and server.

import type { KlokkEvent } from "./klokk-types";

export function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function makeToken(): string {
  return cryptoId().replace(/-/g, "").slice(0, 24);
}

export function computeStatus(event: KlokkEvent): KlokkEvent["status"] {
  if (event.status === "cancelled" || event.status === "closed") return event.status;
  if (event.status === "confirmed") return "confirmed";
  const now = Date.now();
  if (new Date(event.deadline).getTime() < now) return "expired";
  if (event.participationMode === "minimum" && event.minimumCount) {
    if (event.responses.length >= event.minimumCount) return "ready_to_confirm";
  }
  if (event.participationMode === "named" && event.namedParticipants.length > 0) {
    const respondedEmails = new Set(event.responses.map((r) => r.email.toLowerCase()));
    const allResponded = event.namedParticipants.every((p) =>
      respondedEmails.has(p.email.toLowerCase()),
    );
    if (allResponded) return "ready_to_confirm";
  }
  return "awaiting_responses";
}
