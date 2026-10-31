// Shared types for the chat widget UI.
export type ChatState = {
  config?: {
    contactForm?: {
      enabled?: boolean;
      fields?: Array<{
        name: string;
        label: string;
        value: string;
        placeholder?: string;
        required?: boolean;
        dataType?: string;
      }>;
    };
    compliance?: {
      consentText?: string;
      showConsentCheckbox?: boolean;
      defaultConsentCheck?: boolean;
      consentRequired?: boolean;
      a2pConsentText?: string;
    };
    liveChat?: {
      attachments?: {
        enabled?: boolean;
        maxFiles?: number;
        maxFileSizeBytes?: number;
        acceptedTypes?: string[];
      };
      feedbackMessage?: string;
      feedbackNote?: string;
    };
  };
  isReady?: boolean;
  isOpen?: boolean;
  activeChatType?: "liveChat" | "emailChat" | null;
  awaitingChatTypeSelection?: boolean;
  messages?: Array<{
    id?: string;
    body?: string;
    direction?: "inbound" | "outbound" | "system";
    status?: "pending" | "sent" | "failed";
    dateAdded?: number;
    attachments?: string[];
  }>;
  hasMoreHistory?: boolean;
  historyLoading?: boolean;
  agentTyping?: boolean;
  unreadCount?: number;
  canSend?: boolean;
  sendBlockedUntil?: number | null;
  captchaRequired?: boolean;
  captchaStatusMessage?: string;
  rateLimited?: boolean;
  connection?: "idle" | "connecting" | "connected" | "reconnecting" | "offline";
  showContactForm?: boolean;
  contactFormSubmitted?: boolean;
  feedbackRequested?: boolean;
  feedbackSubmitted?: boolean;
  ended?: boolean;
  endedReason?: string;
  attachments?: Array<{
    id: string;
    name?: string;
    status?: "uploading" | "uploaded" | "failed";
    progress?: number;
    error?: string;
    url?: string;
  }>;
  detectedCountry?: string | null;
  detectedCountryResolved?: boolean;
  requestState?: "idle" | "in_progress" | "completed";
  error?: { message?: string; field?: string; code?: string } | null;
};

// Classify an attachment URL so we render it inline correctly.
export const kindOf = (u: string) =>
  /\.(mp4|mov|webm)(\?|$)/i.test(u)
    ? "video"
    : /\.(mp3|m4a|wav|ogg)(\?|$)/i.test(u)
      ? "audio"
      : /\.(png|jpe?g|gif|webp|heic)(\?|$)/i.test(u)
        ? "image"
        : "file";
