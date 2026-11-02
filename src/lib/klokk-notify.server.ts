// Organiser emails and overage invoicing through the HighLevel API (server only).
// Needs HL_API_TOKEN (a private integration token). Everything here is best-effort
// for emails and idempotent for invoices, and never blocks the user's action.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { casualOverage } from "./klokk-limits";
import { warningText, type LimitWarning } from "./klokk-warnings";

const HL = "https://services.leadconnectorhq.com";
const LOCATION_ID = () => process.env["HL_LOCATION_ID"] ?? "0FNYpxrhqqIS9bIV2FDq";

async function admin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function hlHeaders() {
  const token = process.env["HL_API_TOKEN"];
  if (!token) throw new Error("HL_API_TOKEN is not configured");
  return {
    Authorization: `Bearer ${token}`,
    Version: "2021-07-28",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

async function upsertContact(email: string, firstName: string, lastName: string): Promise<string> {
  const res = await fetch(`${HL}/contacts/upsert`, {
    method: "POST",
    headers: hlHeaders(),
    body: JSON.stringify({ locationId: LOCATION_ID(), email, firstName, lastName }),
  });
  if (!res.ok) throw new Error(`contact upsert failed (${res.status})`);
  const j: any = await res.json();
  const id = j.contact?.id ?? j.id;
  if (!id) throw new Error("contact id missing");
  return String(id);
}

export async function sendOrganiserEmail(opts: {
  to: string;
  firstName: string;
  lastName: string;
  subject: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
}): Promise<void> {
  const contactId = await upsertContact(opts.to, opts.firstName, opts.lastName);
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a">` +
    `<p>Hi ${esc(opts.firstName || "there")},</p>` +
    opts.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("") +
    (opts.cta
      ? `<p><a href="${esc(opts.cta.url)}" style="background:#c9a84c;color:#1a1a1a;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">${esc(opts.cta.label)}</a></p>`
      : "") +
    `<p style="color:#666;font-size:12px">Klokk by Pegasus Apps</p></div>`;
  const res = await fetch(`${HL}/conversations/messages`, {
    method: "POST",
    headers: hlHeaders(),
    body: JSON.stringify({ type: "Email", contactId, subject: opts.subject, html }),
  });
  if (!res.ok) throw new Error(`email send failed (${res.status})`);
}

/**
 * Email a limit warning once. The unique row in limit_warnings means a repeat call
 * for the same user, event, kind and period does nothing.
 */
export async function maybeSendWarning(opts: {
  userId: string;
  eventId?: string;
  period?: string;
  warning: LimitWarning;
}): Promise<boolean> {
  const db = await admin();
  const { error } = await db.from("limit_warnings").insert({
    user_id: opts.userId,
    event_id: opts.eventId ?? "00000000-0000-0000-0000-000000000000",
    kind: opts.warning.kind,
    period: opts.period ?? "",
  });
  if (error) return false; // already sent (unique violation) or table missing
  try {
    const { data: p } = await db
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", opts.userId)
      .maybeSingle();
    if (!p?.email) return false;
    const origin = await (await import("./klokk-origin.server")).appOrigin();
    await sendOrganiserEmail({
      to: p.email,
      firstName: p.first_name ?? "",
      lastName: p.last_name ?? "",
      subject: `Klokk: ${opts.warning.title}`,
      paragraphs: warningText(opts.warning).split("\n").filter(Boolean).slice(1),
      cta: { label: "View plans", url: `${origin}/settings?tab=billing` },
    });
    return true;
  } catch (e) {
    // Let the next trigger retry the email.
    await db
      .from("limit_warnings")
      .delete()
      .eq("user_id", opts.userId)
      .eq("event_id", opts.eventId ?? "00000000-0000-0000-0000-000000000000")
      .eq("kind", opts.warning.kind)
      .eq("period", opts.period ?? "");
    console.error("[klokk] warning email failed:", e);
    return false;
  }
}

/**
 * Remember that a Casual event has gone over the 35 included participants. The record
 * lives in its own table (not tied to the event row), so deleting the event, or changing
 * its status directly in the database, cannot make the charge disappear.
 */
export async function recordOveragePending(opts: {
  eventId: string;
  userId: string;
  title: string;
  participants: number;
}): Promise<void> {
  const { blocks, amount } = casualOverage(opts.participants);
  if (blocks === 0) return;
  const db = await admin();
  const { data: existing } = await db
    .from("overage_invoices")
    .select("status")
    .eq("event_id", opts.eventId)
    .maybeSingle();
  if (!existing) {
    await db.from("overage_invoices").insert({
      event_id: opts.eventId,
      user_id: opts.userId,
      title: opts.title,
      participants: opts.participants,
      blocks,
      amount,
    });
  } else if (existing.status === "pending") {
    await db
      .from("overage_invoices")
      .update({ participants: opts.participants, blocks, amount, title: opts.title })
      .eq("event_id", opts.eventId);
  }
}

/**
 * Invoice one pending overage record. Disabled unless OVERAGE_INVOICING=on, and it
 * creates a DRAFT (not sent to the customer) unless OVERAGE_INVOICING_LIVE=on.
 */
export async function invoiceOverage(eventId: string): Promise<void> {
  if (process.env["OVERAGE_INVOICING"] !== "on") return;
  const db = await admin();
  // Claim the record first so two runs can never invoice the same event twice.
  const { data: claimed } = await db
    .from("overage_invoices")
    .update({ status: "sending" })
    .eq("event_id", eventId)
    .eq("status", "pending")
    .select("event_id, user_id, title, participants, blocks, amount")
    .maybeSingle();
  if (!claimed) return;
  const { data: owner } = await db
    .from("profiles")
    .select("email, first_name, last_name")
    .eq("id", claimed.user_id)
    .maybeSingle();
  try {
    if (!owner?.email) throw new Error("organiser has no email");
    const live = process.env["OVERAGE_INVOICING_LIVE"] === "on";
    const contactId = await upsertContact(
      owner.email,
      owner.first_name ?? "",
      owner.last_name ?? "",
    );
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const res = await fetch(`${HL}/invoices/text2pay`, {
      method: "POST",
      headers: hlHeaders(),
      body: JSON.stringify({
        altId: LOCATION_ID(),
        altType: "location",
        name: `Klokk participant overage - ${claimed.title}`,
        currency: "AUD",
        items: [
          {
            name: `Extra participants: ${claimed.title}`,
            description: `${claimed.participants} participants; 35 included; ${claimed.blocks} block(s) of 5 over`,
            currency: "AUD",
            amount: Number(claimed.amount),
            qty: 1,
            type: "one_time",
          },
        ],
        contactDetails: {
          id: contactId,
          name: `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim() || owner.email,
          phoneNo: "",
          email: owner.email,
        },
        issueDate: today,
        dueDate: due,
        sentTo: { email: [owner.email] },
        liveMode: live,
        action: live ? "send" : "draft",
        userId: process.env["HL_INVOICE_USER_ID"] ?? "",
      }),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(`invoice failed (${res.status}) ${JSON.stringify(j).slice(0, 200)}`);
    await db
      .from("overage_invoices")
      .update({ status: live ? "sent" : "skipped", hl_invoice_id: j.invoice?._id ?? null })
      .eq("event_id", eventId);
  } catch (e) {
    await db
      .from("overage_invoices")
      .update({ status: "failed", error: String(e).slice(0, 300) })
      .eq("event_id", eventId);
    console.error("[klokk] overage invoice failed:", e);
  }
}

/** Safety net run by the scheduler: invoice every pending record whose event has finished. */
export async function invoicePendingOverages(): Promise<number> {
  if (process.env["OVERAGE_INVOICING"] !== "on") return 0;
  const db = await admin();
  const { data: pending } = await db
    .from("overage_invoices")
    .select("event_id")
    .eq("status", "pending");
  let n = 0;
  for (const row of (pending ?? []) as { event_id: string }[]) {
    const { data: ev } = await db
      .from("events")
      .select("status, deadline")
      .eq("id", row.event_id)
      .maybeSingle();
    const finished =
      !ev || // event was deleted
      ["confirmed", "closed", "cancelled", "expired"].includes(ev.status) ||
      new Date(ev.deadline).getTime() < Date.now() - 86_400_000;
    if (finished) {
      await invoiceOverage(row.event_id);
      n++;
    }
  }
  return n;
}
