// Limit warnings shown on screen and emailed to organisers. Pure functions, shared
// by the UI and the server so the wording and the numbers always match.

import { CASUAL_INCLUDED_PARTICIPANTS, FREE_LIFETIME_EVENTS, casualOverage } from "./klokk-limits";

export type WarningKind =
  | "participants_near"
  | "participants_reached"
  | "free_events_low"
  | "credits_low"
  | "pack_expiring"
  | "retention_soon";

export interface LimitWarning {
  kind: WarningKind;
  level: "info" | "warn";
  title: string;
  /** plain-text lines; the email and the banner both render these */
  lines: string[];
}

const aud = (n: number) => `$${n.toFixed(2)}`;

/** Participants threshold at which we start warning (about 85% of the cap). */
export function participantWarnAt(cap: number): number {
  return Math.max(1, Math.floor(cap * 0.85));
}

export function participantWarning(
  plan: string | undefined,
  count: number,
  eventTitle?: string,
): LimitWarning | null {
  const of = eventTitle ? ` for "${eventTitle}"` : "";
  if (plan === "free" || plan === undefined) {
    if (count < participantWarnAt(35)) return null;
    const reached = count >= 35;
    return {
      kind: reached ? "participants_reached" : "participants_near",
      level: "warn",
      title: reached
        ? `This event has reached the free limit of 35 participants`
        : `This event is close to the free limit (${count} of 35 participants)`,
      lines: [
        `The Free plan stops accepting responses at 35 participants${of}.`,
        `Casual (credit packs) includes 35 participants per event and keeps accepting responses beyond that. Extra participants are charged per event in blocks of 5: ${aud(6.2)} per block from 36 to 50, then ${aud(5.3)} per block. For example: 40 participants = ${aud(casualOverage(40).amount)}, 50 = ${aud(casualOverage(50).amount)}, 60 = ${aud(casualOverage(60).amount)}.`,
        `Organiser ($17/month) allows up to 80 participants per event with no extra charges.`,
      ],
    };
  }
  if (plan === "casual") {
    if (count < participantWarnAt(CASUAL_INCLUDED_PARTICIPANTS)) return null;
    const over = casualOverage(count);
    const over50 = casualOverage(50);
    const over60 = casualOverage(60);
    return {
      kind: count > CASUAL_INCLUDED_PARTICIPANTS ? "participants_reached" : "participants_near",
      level: "warn",
      title:
        count > CASUAL_INCLUDED_PARTICIPANTS
          ? `This event is over the 35 included participants (${count})`
          : `This event is close to the 35 included participants (${count} of 35)`,
      lines: [
        count > CASUAL_INCLUDED_PARTICIPANTS
          ? `Overage so far${of}: ${aud(over.amount)} (${over.blocks} block${over.blocks === 1 ? "" : "s"} of 5). It will be invoiced to you after the event is confirmed.`
          : `Beyond 35 participants, extra participants are charged per event and invoiced to you after the event is confirmed.`,
        `Rates: ${aud(6.2)} per block of 5 from 36 to 50 participants, then ${aud(5.3)} per block. Estimates: 50 participants = ${aud(over50.amount)}, 60 = ${aud(over60.amount)}.`,
        `Organiser ($17/month) covers up to 80 participants per event with no overage.`,
      ],
    };
  }
  if (plan === "organiser") {
    if (count < participantWarnAt(80)) return null;
    return {
      kind: count >= 80 ? "participants_reached" : "participants_near",
      level: "warn",
      title:
        count >= 80
          ? "This event has reached the Organiser limit of 80 participants"
          : `This event is close to the Organiser limit (${count} of 80 participants)`,
      lines: [
        `Organiser allows up to 80 participants per event${of}.`,
        `Teams ($35/month) has unlimited participants per event.`,
      ],
    };
  }
  return null;
}

export interface EventsLike {
  plan: string;
  eventsCreated: number;
  creditsLeft: number;
  nextExpiry: string | null;
}

export function eventsWarning(b: EventsLike): LimitWarning | null {
  if (b.plan === "free") {
    const left = Math.max(0, FREE_LIFETIME_EVENTS - b.eventsCreated);
    if (left > 1) return null;
    return {
      kind: "free_events_low",
      level: left === 0 ? "warn" : "info",
      title:
        left === 0
          ? `You've used all ${FREE_LIFETIME_EVENTS} free events`
          : `You have 1 free event left`,
      lines: [
        `Credit packs start at $25 for 5 events, $45 for 10 or $60 for 15 (credits last 3 months).`,
        `Organiser is $17/month for unlimited events (up to 80 participants each).`,
      ],
    };
  }
  if (b.plan === "casual") {
    const expiringSoon =
      b.nextExpiry && new Date(b.nextExpiry).getTime() - Date.now() < 7 * 86_400_000;
    if (b.creditsLeft <= 1) {
      return {
        kind: "credits_low",
        level: b.creditsLeft === 0 ? "warn" : "info",
        title: b.creditsLeft === 0 ? "You're out of event credits" : "You have 1 event credit left",
        lines: [
          `A new pack costs $25 (5 events), $45 (10) or $60 (15).`,
          `If you run more than a few events a month, Organiser ($17/month, unlimited events) costs less than buying packs.`,
        ],
      };
    }
    if (expiringSoon) {
      return {
        kind: "pack_expiring",
        level: "info",
        title: "Your event credits expire within 7 days",
        lines: [
          `Unused credits are lost when the pack expires (3 months after purchase).`,
          `Repurchasing packs costs more than Organiser ($17/month, unlimited events) if you run several events a month.`,
        ],
      };
    }
  }
  return null;
}

/** Plain-text body shared by the email. */
export function warningText(w: LimitWarning): string {
  return [w.title, "", ...w.lines].join("\n");
}
