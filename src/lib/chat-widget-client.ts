// One chat client per page session. The core owns backend calls, tokens,
// captcha, sockets, history and message state; we cache the import + client.
import { chatWidgetConfig, loadChatCore } from "./chat-widget-config";

let clientInstance: any = null;

export async function ensureClient() {
  if (clientInstance) return clientInstance;
  const mod = await loadChatCore(chatWidgetConfig.coreUrl);
  const create = mod.createChatClient ?? mod.default?.createChatClient ?? mod.default ?? mod;
  clientInstance = create({
    locationId: chatWidgetConfig.locationId,
    widgetId: chatWidgetConfig.chatWidgetId,
    marketplaceUrl: chatWidgetConfig.marketplaceUrl,
    source: chatWidgetConfig.source,
  });
  return clientInstance;
}

export function regionName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
