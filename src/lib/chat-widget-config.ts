/* eslint-disable @typescript-eslint/no-explicit-any */
// Chat widget integration config — HighLevel headless chat core.
// The core owns backend calls, tokens, captcha, sockets, history and message
// state; the site owns presentation. These values come from the connected
// widget selection and must not be derived or substituted.

export const chatWidgetConfig = {
  chatType: "liveChat" as const,
  chatWidgetId: "6ae5954f352513d0e7dac8b3",
  locationId: "0FNYpxrhqqIS9bIV2FDq",
  coreUrl: "https://widgets.leadconnectorhq.com/chat-widget-core/core.esm.js",
  marketplaceUrl: "https://services.leadconnectorhq.com",
  source: "ai-studio-native",
};

// Cache the dynamic import so the ES module is fetched once per session.
let corePromise: Promise<any> | null = null;
export const loadChatCore = (url: string) => (corePromise ??= import(/* @vite-ignore */ url));
