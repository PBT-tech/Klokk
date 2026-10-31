// Klokk notification layer — posts structured events to the HL tracking
// endpoint, which triggers branded email workflows for each notification type.
// Fire-and-forget from server functions; never blocks the user-facing action.
//
// Custom field IDs (registered via the form-tracking integration):
import type { KlokkEvent } from "./klokk-types";
import { toSlotLabel } from "./klokk-format";

/* eslint-disable @typescript-eslint/no-explicit-any */

const ENDPOINT = "https://backend.leadconnectorhq.com/external-tracking/events";
const TRACKING_ID = "tk_9fa1b07fdc4a47ce8e0d2f1b7bdba934";
const LOCATION_ID = "0FNYpxrhqqIS9bIV2FDq";
const PROJECT_ID = "1793243379516754418";

// Registered custom-field IDs.
const CF = {
  eventTitle: "BxxH5sILUN4RK6sC86La",
  eventLink: "tmdysJH7XzvRTHOWwchv",
  organiserName: "rxFXBhwHKyMMiaTEGSaC",
  deadline: "MvPKxBEG24r1HEYB54oQ",
  confirmedTime: "TqQZz1icLo4ZgVxyvoex",
  location: "XTwVtYzAxKIeTSmbxNdC",
  eventDescription: "pRn1lQsay3AmlpQewGEW",
};

type NotificationType =
  | "invitation"
  | "submission_confirmation"
  | "reminder"
  | "meeting_confirmation"
  | "event_cancelled"
  | "signup_notification";

const FORM_IDS: Record<NotificationType, string> = {
  invitation: "klokk-event-invitation",
  submission_confirmation: "klokk-submission-confirmation",
  reminder: "klokk-response-reminder",
  meeting_confirmation: "klokk-meeting-confirmation",
  event_cancelled: "klokk-event-cancelled",
  signup_notification: "klokk-signup-notification",
};

const FORM_NAMES: Record<NotificationType, string> = {
  invitation: "Klokk Event Invitation",
  submission_confirmation: "Klokk Submission Confirmation",
  reminder: "Klokk Response Reminder",
  meeting_confirmation: "Klokk Meeting Confirmation",
  event_cancelled: "Klokk Event Cancelled",
  signup_notification: "Klokk Signup Notification",
};

interface BasePayload {
  recipientEmail: string;
  recipientFirstName: string;
  recipientLastName: string;
}

interface EventPayload extends BasePayload {
  event: KlokkEvent;
  organiserName: string;
  origin: string;
}

function postEvent(
  type: NotificationType,
  payload: BasePayload,
  customFields: Record<string, { value: unknown; label: string }>,
) {
  const formData: Record<string, unknown> = {
    first_name: payload.recipientFirstName,
    last_name: payload.recipientLastName,
    email: payload.recipientEmail,
  };
  const formLabels: Record<string, string> = {
    first_name: "First name",
    last_name: "Last name",
    email: "Email",
  };

  for (const [key, field] of Object.entries(customFields)) {
    if (field.value === undefined || field.value === null) continue;
    formData[key] = field.value;
    formLabels[key] = field.label;
  }

  const pageUrl =
    typeof window !== "undefined" ? window.location.href : "https://klokk.vibepreview.app";

  const eventPayload = {
    type: "external_form_submission",
    timestamp: Date.now(),
    formId: FORM_IDS[type],
    formData,
    formLabels,
    pageUrl,
    url: pageUrl,
    title: FORM_NAMES[type],
    path: typeof window !== "undefined" ? window.location.pathname : "",
    userAgent: "klokk-server",
    trackingId: TRACKING_ID,
    locationId: LOCATION_ID,
    projectId: PROJECT_ID,
    sessionId: crypto.randomUUID(),
    properties: {
      deviceType: "desktop",
      source: "ai_studio",
      projectId: PROJECT_ID,
      formName: FORM_NAMES[type],
    },
  };

  const body = new FormData();
  body.append("event", JSON.stringify(eventPayload));

  fetch(ENDPOINT, {
    method: "POST",
    headers: { version: "2021-07-28" },
    body,
  }).catch(() => {});
}

function eventLink(origin: string, token: string) {
  return `${origin}/event/${token}`;
}

function eventCustomFields(
  event: KlokkEvent,
  organiserName: string,
  origin: string,
  extra?: Record<string, { value: unknown; label: string }>,
) {
  return {
    [CF.eventTitle]: { value: event.title, label: "Event Title" },
    [CF.eventLink]: { value: eventLink(origin, event.token), label: "Event Link" },
    [CF.organiserName]: { value: organiserName, label: "Organiser Name" },
    [CF.deadline]: { value: new Date(event.deadline).toLocaleString(), label: "Deadline" },
    [CF.location]: { value: event.location ?? "", label: "Location" },
    [CF.eventDescription]: { value: event.description ?? "", label: "Event Description" },
    ...extra,
  };
}

// ---------- Public notification triggers ----------

/** F7: invitation email to a participant (contains the unique link). */
export function sendInvitation(p: EventPayload) {
  postEvent("invitation", p, eventCustomFields(p.event, p.organiserName, p.origin));
}

/** F4/F7: submission confirmation email to the participant who just submitted. */
export function sendSubmissionConfirmation(p: EventPayload) {
  postEvent("submission_confirmation", p, eventCustomFields(p.event, p.organiserName, p.origin));
}

/** F7: reminder to an outstanding named participant. */
export function sendReminder(p: EventPayload) {
  postEvent("reminder", p, eventCustomFields(p.event, p.organiserName, p.origin));
}

/** F6/F7: final meeting confirmation to all participants who responded. */
export function sendMeetingConfirmation(p: EventPayload) {
  const slot = p.event.slots.find((s) => s.id === p.event.confirmedSlotId);
  const confirmedTime = slot ? toSlotLabel(slot.date, slot.startTime, slot.endTime) : "";
  postEvent(
    "meeting_confirmation",
    p,
    eventCustomFields(p.event, p.organiserName, p.origin, {
      [CF.confirmedTime]: { value: confirmedTime, label: "Confirmed Time" },
    }),
  );
}

/** F9: cancellation notice to participants. */
export function sendCancellation(p: EventPayload) {
  postEvent("event_cancelled", p, eventCustomFields(p.event, p.organiserName, p.origin));
}

/** Notify the sub-account owner that a new organiser signed up.
 *  Posts the new organiser as the contact; the HL workflow (location owner)
 *  handles the owner-facing notification email. */
export function sendSignupNotification(p: { newOrganiserEmail: string; newOrganiserName: string }) {
  const [first = "", ...rest] = p.newOrganiserName.split(" ");
  postEvent(
    "signup_notification",
    {
      recipientEmail: p.newOrganiserEmail,
      recipientFirstName: first,
      recipientLastName: rest.join(" "),
    },
    {
      [CF.organiserName]: { value: p.newOrganiserName, label: "New Organiser Name" },
      [CF.eventTitle]: { value: p.newOrganiserEmail, label: "New Organiser Email" },
    },
  );
}
