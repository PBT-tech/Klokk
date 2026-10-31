import { useState } from "react";
import { Pin, PinOff, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAddChatMessage, useTogglePin } from "@/lib/klokk-hooks";
import { formatTime } from "@/lib/klokk-format";
import type { ChatMessage, KlokkEvent } from "@/lib/klokk-types";

export function EventChat({
  event,
  asOrganiser,
  authorName,
  authorEmail,
}: {
  event: KlokkEvent;
  asOrganiser: boolean;
  authorName: string;
  authorEmail?: string;
}) {
  const [text, setText] = useState("");
  const addChat = useAddChatMessage();
  const togglePin = useTogglePin();

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    addChat.mutate(
      {
        eventId: event.id,
        authorName,
        authorEmail,
        text: text.trim(),
      },
      {
        onSuccess: () => setText(""),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Could not send message"),
      },
    );
  };

  const pinned = event.chat.filter((m) => m.pinned).slice(0, 3);
  const rest = event.chat.filter((m) => !m.pinned);

  return (
    <div className="flex h-full flex-col">
      {pinned.length > 0 && (
        <div className="border-b border-border/70 bg-accent/5 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
            <Pin className="size-3" /> Pinned
          </p>
          <div className="space-y-1.5">
            {pinned.map((m) => (
              <PinnedRow
                key={m.id}
                message={m}
                canUnpin={asOrganiser}
                eventId={event.id}
                togglePin={togglePin}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {event.chat.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet. Start the conversation.
          </p>
        )}
        {rest.map((m) => (
          <MessageRow
            key={m.id}
            message={m}
            canPin={asOrganiser}
            eventId={event.id}
            togglePin={togglePin}
          />
        ))}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-border/70 p-3">
        <Input
          placeholder="Write a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" size="icon" disabled={!text.trim() || addChat.isPending}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}

function MessageRow({
  message,
  canPin,
  eventId,
  togglePin,
}: {
  message: ChatMessage;
  canPin: boolean;
  eventId: string;
  togglePin: ReturnType<typeof useTogglePin>;
}) {
  return (
    <div className="group flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-full text-[10px] font-semibold",
            message.isOrganiser
              ? "bg-primary text-primary-foreground"
              : "bg-surface-muted text-muted-foreground",
          )}
        >
          {message.authorName.slice(0, 1).toUpperCase()}
        </span>
        <span className="text-xs font-medium text-foreground">
          {message.authorName}
          {message.isOrganiser && (
            <span className="ml-1 rounded bg-primary/10 px-1 text-[9px] font-semibold text-primary">
              Organiser
            </span>
          )}
        </span>
        <span className="text-[10px] text-muted-foreground">{formatTime(message.createdAt)}</span>
        {canPin && (
          <button
            type="button"
            onClick={() => togglePin.mutate({ eventId, messageId: message.id })}
            className="ml-auto text-muted-foreground opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
            aria-label="Pin message"
          >
            <Pin className="size-3.5" />
          </button>
        )}
      </div>
      <p className="ml-8 text-sm text-foreground">{message.text}</p>
    </div>
  );
}

function PinnedRow({
  message,
  canUnpin,
  eventId,
  togglePin,
}: {
  message: ChatMessage;
  canUnpin: boolean;
  eventId: string;
  togglePin: ReturnType<typeof useTogglePin>;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-card px-3 py-2">
      <p className="flex-1 text-xs text-foreground">
        <span className="font-medium">{message.authorName}: </span>
        {message.text}
      </p>
      {canUnpin && (
        <button
          type="button"
          onClick={() => {
            togglePin.mutate({ eventId, messageId: message.id });
            toast.message("Unpinned");
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Unpin"
        >
          <PinOff className="size-3.5" />
        </button>
      )}
    </div>
  );
}
