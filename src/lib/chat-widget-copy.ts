// Presentation copy for the site-owned chat UI.
// The record (welcome_message, feedback_message, feedback_note) lives on the
// widget and is rendered verbatim from core state; everything site-owned lives
// here. Tone: warm & human.

export const chatCopy = {
  // Launcher bubble (beside the closed launcher) + heading inside the panel.
  heading: "We're here",
  teaser: "Hey, scheduling shouldn't be a headache. Let's make it easy.",
  // Quick replies shown before the first message.
  quickReplies: ["See how Klokk works", "What's a free event?", "Compare plans"],
  // Status / transient lines (shown only while a flag is set).
  reconnecting: "Reconnecting…",
  offline: "You're offline — messages will send when you're back.",
  typingHint: "Sage is typing…",
  // Transcript / empty state.
  emptyThread: "Say hi and we'll help you find a time that works.",
  // Composer.
  composerPlaceholder: "Type a message…",
  sendLabel: "Send",
  attachLabel: "Attach a file",
  // Error / retry.
  retryLabel: "Try again",
  loadError: "We couldn't open chat right now.",
  // Contact form.
  contactFormTitle: "Tell us a bit about you",
  contactFormSubmit: "Start chat",
  // Feedback.
  feedbackPrompt: "How did we do today?",
  feedbackPositive: "Great",
  feedbackNegative: "Could be better",
  // Restart / ended.
  restartLabel: "Start a new chat",
  endedHint: "This chat has ended.",
};
