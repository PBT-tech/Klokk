// CRM form-tracking helper. Fire-and-forget — never blocks form UX.
// Used by the Form Tracking integration skill.

type StandardTrackingFieldKey = string;
type RegisteredCustomFieldId = string;
type TrackingCustomField = { value?: unknown; label: string };
type TrackingFileField = { file?: File; label: string };
type TrackingImageDataField = { dataUrl?: string; label: string };

export const TRACKING = {
  trackingId: "tk_9fa1b07fdc4a47ce8e0d2f1b7bdba934",
  locationId: "0FNYpxrhqqIS9bIV2FDq",
  projectId: "1793243379516754418",
  endpoint: "https://backend.leadconnectorhq.com/external-tracking/events",
};

export const postTrackingEvent = (
  trackingPayload: Record<string, unknown> & {
    formData: Record<StandardTrackingFieldKey, unknown>;
    formLabels: Record<StandardTrackingFieldKey, string>;
  },
  options: {
    customFields?: Record<RegisteredCustomFieldId, TrackingCustomField>;
    fileFields?: Record<RegisteredCustomFieldId, TrackingFileField>;
    imageDataFields?: Record<RegisteredCustomFieldId, TrackingImageDataField>;
  } = {},
) => {
  const { customFields = {}, fileFields = {}, imageDataFields = {} } = options;
  const eventPayload = {
    ...trackingPayload,
    formData: { ...trackingPayload.formData },
    formLabels: { ...trackingPayload.formLabels },
  };
  const body = new FormData();

  for (const [key, field] of Object.entries(customFields)) {
    if (field.value === undefined) continue;
    eventPayload.formData[key] = field.value;
    eventPayload.formLabels[key] = field.label;
  }

  for (const [key, field] of Object.entries(imageDataFields)) {
    const dataUrl = field.dataUrl;
    if (!dataUrl) continue;
    if (!dataUrl.startsWith("data:image/")) {
      throw new Error("Image data field must be a data:image/* base64 string");
    }
    eventPayload.formData[key] = dataUrl;
    eventPayload.formLabels[key] = field.label;
  }

  for (const [key, field] of Object.entries(fileFields)) {
    const file = field.file;
    if (!file) continue;
    if (file.size > 50 * 1024 * 1024) {
      throw new Error("File must be 50 MB or smaller");
    }
    eventPayload.formData[key] = {
      filename: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
    };
    eventPayload.formLabels[key] = field.label;
    body.append(key, file, file.name);
  }

  for (const key of Object.keys(eventPayload.formData)) {
    eventPayload.formLabels[key] ||= key;
  }

  body.append("event", JSON.stringify(eventPayload));

  fetch(TRACKING.endpoint, {
    method: "POST",
    headers: { version: "2021-07-28" },
    body,
  }).catch(() => {});
};

export const getTrackingSessionId = () => {
  try {
    const sid = document.cookie.match(/(?:^|;\s*)__vibe_sid=([0-9a-f-]{36})(?:;|$)/)?.[1];
    if (sid) return sid;
  } catch {
    /* sandboxed iframe — fall through */
  }
  return crypto.randomUUID();
};

export function buildTrackingPayload(
  formId: string,
  formName: string,
  formData: Record<string, unknown>,
  formLabels: Record<string, string>,
) {
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  return {
    type: "external_form_submission",
    timestamp: Date.now(),
    formId,
    formData,
    formLabels,
    pageUrl,
    url: pageUrl,
    title: typeof document !== "undefined" ? document.title : "",
    path: typeof window !== "undefined" ? window.location.pathname : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    trackingId: TRACKING.trackingId,
    locationId: TRACKING.locationId,
    projectId: TRACKING.projectId,
    sessionId: getTrackingSessionId(),
    properties: {
      deviceType:
        typeof navigator !== "undefined" && /Mobile|Android|iPhone/i.test(navigator.userAgent)
          ? "mobile"
          : "desktop",
      source: "ai_studio",
      projectId: TRACKING.projectId,
      formName,
    },
  };
}
