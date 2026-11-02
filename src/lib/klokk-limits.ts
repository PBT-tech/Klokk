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
