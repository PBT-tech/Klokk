import { useEffect, useMemo, useState } from "react";
import { Loader2, ChevronDown, Send, X, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { chatCopy } from "@/lib/chat-widget-copy";
import { kindOf, type ChatState } from "@/lib/chat-widget-types";
import { regionName } from "@/lib/chat-widget-client";
import {
  parsePhoneNumberFromString,
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";

export function Header({ onClose, state }: { onClose: () => void; state: ChatState }) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-primary/10 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-semibold text-card-foreground">
          {chatCopy.heading}
        </p>
        <p className="truncate text-xs text-muted-foreground">{chatCopy.teaser}</p>
      </div>
      <div className="flex items-center gap-2">
        {state.agentTyping ? (
          <span className="text-xs text-muted-foreground">{chatCopy.typingHint}</span>
        ) : null}
        <button
          onClick={onClose}
          aria-label="Close chat"
          className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function ThankYou() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="font-display text-lg font-semibold text-card-foreground">Thanks!</p>
      <p className="text-sm text-muted-foreground">
        We've got your details and we'll be in touch soon.
      </p>
    </div>
  );
}

export function MessageBubble({ m }: { m: NonNullable<ChatState["messages"]>[number] }) {
  if (m.direction === "system") {
    return (
      <div className="my-1 text-center text-xs text-muted-foreground">
        <span className="rounded-full bg-surface px-2 py-0.5">{m.body}</span>
      </div>
    );
  }
  const mine = m.direction === "outbound";
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
          mine
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-surface text-card-foreground",
          m.status === "pending" && "opacity-60",
          m.status === "failed" && "ring-1 ring-destructive",
        )}
      >
        {m.body}
        {m.attachments?.map((url, i) => {
          const k = kindOf(url);
          return k === "image" ? (
            <img key={i} src={url} alt="" className="mt-1 max-h-40 rounded-lg object-cover" />
          ) : k === "video" ? (
            <video key={i} src={url} controls className="mt-1 max-h-40 rounded-lg" />
          ) : k === "audio" ? (
            <audio key={i} src={url} controls className="mt-1 w-full" />
          ) : (
            <a key={i} href={url} target="_blank" rel="noreferrer" className="mt-1 block underline">
              Attachment
            </a>
          );
        })}
      </div>
    </div>
  );
}

export function LiveChat({
  state,
  threadRef,
  text,
  setText,
  send,
  showForm,
  showFeedback,
  showEnded,
  cardPending,
  connectionLine,
  client,
}: {
  state: ChatState;
  threadRef: React.RefObject<HTMLDivElement | null>;
  text: string;
  setText: (s: string) => void;
  send: () => void;
  showForm: boolean;
  showFeedback: boolean;
  showEnded: boolean;
  cardPending: boolean;
  connectionLine: string | null;
  client: React.MutableRefObject<any>;
}) {
  return (
    <>
      <div ref={threadRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {state.hasMoreHistory ? (
          <div className="mb-2 flex justify-center">
            <button
              onClick={() => client.current?.loadOlderMessages?.()}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-surface"
            >
              {state.historyLoading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <ChevronDown className="size-3" />
              )}
              Load earlier
            </button>
          </div>
        ) : null}
        {(!state.messages || state.messages.length === 0) && !state.agentTyping ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-sm text-muted-foreground">{chatCopy.emptyThread}</p>
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          {state.messages?.map((m, i) => (
            <MessageBubble key={m.id ?? i} m={m} />
          ))}
        </div>
        {state.agentTyping ? (
          <div className="mt-2 flex items-center gap-1 text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-current" />
            <span
              className="size-1.5 animate-pulse rounded-full bg-current"
              style={{ animationDelay: "0.2s" }}
            />
            <span
              className="size-1.5 animate-pulse rounded-full bg-current"
              style={{ animationDelay: "0.4s" }}
            />
          </div>
        ) : null}
        {state.awaitingChatTypeSelection ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">How would you like to chat?</p>
            <div className="flex gap-2">
              <button
                onClick={() => client.current?.setActiveChatType?.("liveChat")}
                className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
              >
                Live chat
              </button>
              <button
                onClick={() => client.current?.setActiveChatType?.("emailChat")}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-surface"
              >
                Email
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {connectionLine ? (
        <div className="px-4 py-1.5 text-center text-xs text-muted-foreground">
          {connectionLine}
        </div>
      ) : null}

      {showForm ? (
        <ContactForm state={state} client={client} />
      ) : showFeedback ? (
        <FeedbackCard state={state} client={client} />
      ) : showEnded ? (
        <EndedCard client={client} state={state} />
      ) : (
        <Composer
          state={state}
          text={text}
          setText={setText}
          send={send}
          client={client}
          disabled={!!cardPending}
        />
      )}
    </>
  );
}

function Composer({
  state,
  text,
  setText,
  send,
  client,
  disabled,
}: {
  state: ChatState;
  text: string;
  setText: (s: string) => void;
  send: () => void;
  client: React.MutableRefObject<any>;
  disabled: boolean;
}) {
  const att = state.config?.liveChat?.attachments;
  const attEnabled = att?.enabled;
  const uploading = state.attachments?.some((a) => a.status === "uploading");
  const readyCount = state.attachments?.filter((a) => a.status === "uploaded").length ?? 0;
  const disabledSend =
    disabled ||
    !state.canSend ||
    !!state.captchaRequired ||
    uploading ||
    (!text.trim() && readyCount === 0);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) await client.current?.uploadAttachment?.(f);
    e.target.value = "";
  };

  return (
    <div className="border-t border-border p-3">
      {state.attachments && state.attachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {state.attachments.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2 py-1 text-xs text-card-foreground"
            >
              <span className="max-w-24 truncate">{a.name ?? "File"}</span>
              {a.status === "uploading" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : a.status === "failed" ? (
                <span className="text-destructive">{a.error ?? "failed"}</span>
              ) : null}
              <button
                onClick={() => client.current?.removeAttachment?.(a.id)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Remove"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {state.captchaRequired ? (
        <p className="mb-2 text-xs text-muted-foreground">
          {state.captchaStatusMessage ?? "Please complete the check above."}
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        {attEnabled ? (
          <label className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-surface">
            <Paperclip className="size-4" />
            <input
              type="file"
              className="hidden"
              onChange={onFile}
              accept={att?.acceptedTypes?.join(",")}
            />
          </label>
        ) : null}
        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={chatCopy.composerPlaceholder}
          className="max-h-24 min-h-9 flex-1 resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={send}
          disabled={disabledSend}
          className="inline-flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-95"
          aria-label={chatCopy.sendLabel}
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  );
}

function FeedbackCard({
  state,
  client,
}: {
  state: ChatState;
  client: React.MutableRefObject<any>;
}) {
  return (
    <div className="border-t border-border p-4">
      <p className="text-sm font-medium text-card-foreground">
        {state.config?.liveChat?.feedbackMessage ?? chatCopy.feedbackPrompt}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => client.current?.sendFeedback?.("positive")}
          className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
        >
          {chatCopy.feedbackPositive}
        </button>
        <button
          onClick={() => client.current?.sendFeedback?.("negative")}
          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-surface"
        >
          {chatCopy.feedbackNegative}
        </button>
      </div>
    </div>
  );
}

function EndedCard({ client, state }: { client: React.MutableRefObject<any>; state: ChatState }) {
  if (state.feedbackSubmitted) {
    return (
      <div className="border-t border-border p-4 text-center">
        <p className="text-sm text-muted-foreground">
          {state.config?.liveChat?.feedbackNote ?? "Thanks — that helps us improve."}
        </p>
        <button
          onClick={() => client.current?.restartConversation?.()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-surface"
        >
          {chatCopy.restartLabel}
        </button>
      </div>
    );
  }
  return (
    <div className="border-t border-border p-4 text-center">
      <p className="text-sm text-muted-foreground">{chatCopy.endedHint}</p>
      <button
        onClick={() => client.current?.restartConversation?.()}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-surface"
      >
        {chatCopy.restartLabel}
      </button>
    </div>
  );
}

function ContactForm({ state, client }: { state: ChatState; client: React.MutableRefObject<any> }) {
  const fields = state.config?.contactForm?.fields ?? [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const comp = state.config?.compliance;
  const [consent, setConsent] = useState<boolean>(comp?.defaultConsentCheck ?? false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const req = fields
      .filter((f) => f.required && !(values[f.value] ?? "").trim())
      .map((f) => f.label);
    if (req.length) {
      setMissing(req);
      return;
    }
    if (comp?.consentRequired && !consent) return;
    const payload = Object.fromEntries(fields.map((f) => [f.value, values[f.value] ?? ""]));
    await client.current?.submitContactForm?.({ ...payload, consentGiven: consent });
  };

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      <p className="font-display text-sm font-semibold text-card-foreground">
        {chatCopy.contactFormTitle}
      </p>
      {fields.map((f) => (
        <div key={f.value} className="space-y-1">
          <label className="text-xs font-medium text-card-foreground">
            {f.label}
            {f.required ? " *" : ""}
          </label>
          {f.dataType === "PHONE" ? (
            <PhoneField
              field={f}
              value={values[f.value] ?? ""}
              onChange={(v) => {
                setValues((s) => ({ ...s, [f.value]: v }));
                setMissing((m) => m.filter((x) => x !== f.label));
              }}
              state={state}
            />
          ) : f.dataType === "TEXTAREA" ? (
            <textarea
              value={values[f.value] ?? ""}
              placeholder={f.placeholder}
              required={f.required}
              onChange={(e) => {
                setValues((s) => ({ ...s, [f.value]: e.target.value }));
                setMissing((m) => m.filter((x) => x !== f.label));
              }}
              className="min-h-16 w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          ) : (
            <input
              type={f.dataType === "EMAIL" ? "email" : "text"}
              value={values[f.value] ?? ""}
              placeholder={f.placeholder}
              required={f.required}
              onChange={(e) => {
                setValues((s) => ({ ...s, [f.value]: e.target.value }));
                setMissing((m) => m.filter((x) => x !== f.label));
              }}
              className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}
          {missing.includes(f.label) ? <p className="text-xs text-destructive">Required</p> : null}
        </div>
      ))}
      {comp?.showConsentCheckbox ? (
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span>{comp.consentText}</span>
        </label>
      ) : null}
      {comp?.a2pConsentText ? (
        <p className="text-xs text-muted-foreground">{comp.a2pConsentText}</p>
      ) : null}
      <button
        type="submit"
        disabled={state.requestState === "in_progress" || (comp?.consentRequired && !consent)}
        className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:opacity-95"
      >
        {chatCopy.contactFormSubmit}
      </button>
    </form>
  );
}

function PhoneField({
  field,
  value,
  onChange,
  state,
}: {
  field: { value: string; placeholder?: string; required?: boolean };
  value: string;
  onChange: (v: string) => void;
  state: ChatState;
}) {
  const [raw, setRaw] = useState("");
  const [country, setCountry] = useState<CountryCode>(
    (state.detectedCountry as CountryCode) ?? "US",
  );
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const countries = useMemo(() => {
    try {
      return getCountries()
        .map((c) => ({
          c,
          name: regionName(c),
          dial: `+${getCountryCallingCode(c)}`,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    if (!raw && state.detectedCountry) setCountry(state.detectedCountry as CountryCode);
  }, [state.detectedCountry, raw]);

  const update = (text: string, c = country) => {
    setRaw(text);
    const p = parsePhoneNumberFromString(text, c);
    onChange(p?.isValid() ? p.number : "");
  };

  return (
    <div className="relative flex gap-2">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center rounded-lg border border-border bg-surface px-2 py-2 text-sm text-card-foreground"
      >
        +{getCountryCallingCode(country)}
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute z-20 mt-10 max-h-56 w-64 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-premium"
        >
          <input
            autoFocus
            placeholder="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            className="mb-1 w-full rounded border border-border bg-transparent px-2 py-1 text-sm"
          />
          {countries
            .filter((x) => x.name.toLowerCase().includes(q.toLowerCase()))
            .map((x) => (
              <div
                key={x.c}
                role="option"
                aria-selected={x.c === country}
                onClick={() => {
                  setCountry(x.c);
                  setOpen(false);
                  update(raw, x.c);
                }}
                className="cursor-pointer rounded px-2 py-1 text-sm hover:bg-surface"
              >
                {x.name} {x.dial}
              </div>
            ))}
        </div>
      ) : null}
      <input
        type="tel"
        name={field.value}
        required={field.required}
        placeholder={field.placeholder}
        value={raw}
        onChange={(e) => update(e.target.value)}
        className="flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
