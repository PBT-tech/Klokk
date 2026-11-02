// Plan limits shared by the UI and server functions (mirrors the database
// triggers in supabase/migrations/20261102010000_*.sql).

import type { KlokkPlanTier } from "./klokk-types";

export const FREE_LIFETIME_EVENTS = 3;

/** Hard participant cap per event, or null where there is no hard cap. */
export function participantCapForPlan(plan: string | null | undefined): number | null {
  switch (plan as KlokkPlanTier | undefined) {
    case "organiser":
      return 80;
    case "teams":
      return null; // unlimited
    case "casual":
      return null; // 35 included; extra participants are billed in blocks of 5
    default:
      return 35; // free
  }
}

// ---- Casual credit packs and participant overage (PRD pricing) ----

export const CASUAL_INCLUDED_PARTICIPANTS = 35;
export const CASUAL_PACK_VALID_MONTHS = 3;
const OVERAGE_BLOCK_SIZE = 5;
/** Blocks 1–3 (participants 36–50) cost $6.20 each; block 4 onwards $5.30 each. */
const OVERAGE_RATE_FIRST_BLOCKS = 6.2;
const OVERAGE_RATE_LATER_BLOCKS = 5.3;
const OVERAGE_FIRST_BLOCK_COUNT = 3;

export interface Overage {
  blocks: number;
  amount: number;
}

/** Overage for ONE event on a Casual plan: charged per block of 5 above 35, never pooled. */
export function casualOverage(participants: number): Overage {
  const extra = Math.max(0, participants - CASUAL_INCLUDED_PARTICIPANTS);
  const blocks = Math.ceil(extra / OVERAGE_BLOCK_SIZE);
  const first = Math.min(blocks, OVERAGE_FIRST_BLOCK_COUNT);
  const later = Math.max(0, blocks - OVERAGE_FIRST_BLOCK_COUNT);
  const amount =
    Math.round((first * OVERAGE_RATE_FIRST_BLOCKS + later * OVERAGE_RATE_LATER_BLOCKS) * 100) / 100;
  return { blocks, amount };
}
