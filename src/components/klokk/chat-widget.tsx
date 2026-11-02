/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Loader2 } from "lucide-react";
import { chatCopy } from "@/lib/chat-widget-copy";
import { ensureClient } from "@/lib/chat-widget-client";
import { type ChatState } from "@/lib/chat-widget-types";
import { Header, LiveChat, ThankYou } from "./chat-widget-thread";

export function ChatWidget() {
  const [state, setState] = useState<ChatState>({});
  const [open, setOpen] = useState(false);
  const [coreError, setCoreError] = useState<string | null>(null);
  const [loadingCore, setLoadingCore] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<any>(null);
  const openIntentRef = useRef(false);

  useEffect(() => {
    let active = true;
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        setLoadingCore(true);
        const chat = await ensureClient();
        if (!active) return;
        clientRef.current = chat;
        unsub = chat.subscribe((s: ChatState) => {
          if (active) setState(s);
        });
        if (openIntentRef.current) {
          chat.setPanelOpen(true);
          await chat.open();
        }
      } catch (e: any) {
        if (active) setCoreError(e?.message ?? "Failed to load chat");
      } finally {
        if (active) setLoadingCore(false);
      }
    })();
    return () => {
      active = false;
      try {
        unsub?.();
        clientRef.current?.close?.();
      } catch {
        /* widget teardown is best-effort */
      }
    };
  }, []);

  useEffect(() => {
    if (state.isOpen === undefined) return;
    if (state.isOpen !== open) setOpen(state.isOpen);
  }, [state.isOpen, open]);

  const handleOpen = async () => {
    if (open) {
      setOpen(false);
      try {
        clientRef.current?.setPanelOpen?.(false);
        clientRef.current?.close?.();
      } catch {
        /* widget teardown is best-effort */
      }
      return;
    }
    setOpen(true);
    openIntentRef.current = true;
    if (clientRef.current) {
      try {
        clientRef.current.setPanelOpen(true);
        await clientRef.current.open();
      } catch (e: any) {
        setCoreError(e?.message ?? "Couldn't open chat");
      }
    }
  };

  const send = async () => {
    const uploading = state.attachments?.some((a) => a.status === "uploading");
    const ready = state.attachments?.filter((a) => a.status === "uploaded").map((a) => a.url) ?? [];
    if (!state.canSend || uploading || (!text.trim() && ready.length === 0)) return;
    const msg = text;
    setText("");
    await clientRef.current?.sendMessage?.({ text: msg, attachments: ready });
  };

  const [text, setText] = useState("");

  const showForm = !!state.showContactForm;
  const showFeedback = !!state.feedbackRequested && !state.feedbackSubmitted && !state.ended;
  const showEnded = !!state.ended;
  const cardPending = showForm || showFeedback || showEnded;
  const connectionLine = state.error?.message
    ? state.error.message
    : state.connection === "reconnecting"
      ? chatCopy.reconnecting
      : state.connection === "offline"
        ? chatCopy.offline
        : null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 print:hidden">
      {open && (
        <div
          ref={panelRef}
          className="flex w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-premium"
          style={{ height: "min(640px, 100dvh - 7rem)" }}
        >
          <Header onClose={() => handleOpen()} state={state} />
          {coreError && !state.config ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">{chatCopy.loadError}</p>
              <button
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-95"
                onClick={() => {
                  setCoreError(null);
                  clientRef.current?.open?.();
                }}
              >
                {chatCopy.retryLabel}
              </button>
            </div>
          ) : !state.config ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : state.activeChatType === "emailChat" ? (
            state.contactFormSubmitted ? (
              <ThankYou />
            ) : (
              <LiveChat
                state={state}
                threadRef={threadRef}
                text={text}
                setText={setText}
                send={send}
                showForm={showForm || !!state.config?.contactForm?.enabled}
                showFeedback={showFeedback}
                showEnded={showEnded}
                cardPending={cardPending}
                connectionLine={connectionLine}
                client={clientRef}
              />
            )
          ) : state.activeChatType === "liveChat" || state.awaitingChatTypeSelection ? (
            <LiveChat
              state={state}
              threadRef={threadRef}
              text={text}
              setText={setText}
              send={send}
              showForm={showForm}
              showFeedback={showFeedback}
              showEnded={showEnded}
              cardPending={cardPending}
              connectionLine={connectionLine}
              client={clientRef}
            />
          ) : null}
        </div>
      )}

      <button
        onClick={() => handleOpen()}
        aria-label="Open chat"
        className="relative inline-flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-premium transition-transform hover:scale-105"
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
        {!open && state.unreadCount ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
            {state.unreadCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}
