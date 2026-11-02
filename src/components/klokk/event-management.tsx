import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarX,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Mail,
  MessageSquare,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/klokk/status-badge";
import { AvailabilityHeatMap, bestSlot } from "@/components/klokk/heat-map";
import { EventChat } from "@/components/klokk/event-chat";
import { EmbedPanel } from "@/components/klokk/embed-panel";
import { Avatar } from "@/components/klokk/avatar";
import {
  useUpdateEvent,
  useDeleteEvent,
  useAddChatMessage,
  useTogglePin,
  useSendReminder,
  useSendInvitations,
} from "@/lib/klokk-hooks";
import { computeStatus } from "@/lib/klokk-store";
import { participantWarning } from "@/lib/klokk-warnings";
import { LimitBanner } from "@/components/klokk/limit-banner";
import {
  confirmedTimeLabel,
  formatDate,
  formatDateTime,
  relativeDeadline,
  toSlotLabel,
} from "@/lib/klokk-format";
import type { KlokkAccount, KlokkEvent } from "@/lib/klokk-types";

export function EventManagement({ event, account }: { event: KlokkEvent; account: KlokkAccount }) {
  const navigate = useNavigate();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const sendReminder = useSendReminder();
  const sendInvitations = useSendInvitations();
  const [confirmSlotId, setConfirmSlotId] = useState<string | undefined>(event.confirmedSlotId);
  const [showChat, setShowChat] = useState(false);
  const [useCustom, setUseCustom] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customStart, setCustomStart] = useState("09:00");
  const [customEnd, setCustomEnd] = useState("10:00");
  const status = computeStatus(event);
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/event/${event.token}`;
  const best = bestSlot(event);
  const warning = participantWarning(account.plan, event.responses.length, event.title);

  const respondedEmails = useMemo(
    () => new Set(event.responses.map((r) => r.email.toLowerCase())),
    [event.responses],
  );

  const copyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(link).then(
        () => toast.success("Link copied"),
        () => toast.error("Couldn't copy"),
      );
    }
  };

  const confirm = () => {
    if (useCustom) {
      if (!customDate || !customStart || !customEnd) {
        toast.error("Enter a date, start and end time");
        return;
      }
      if (customEnd <= customStart) {
        toast.error("The end time must be after the start time");
        return;
      }
    } else if (!confirmSlotId) {
      toast.error("Pick a time to confirm");
      return;
    }
    updateEvent.mutate(
      {
        id: event.id,
        status: "confirmed",
        confirmedSlotId: useCustom ? null : confirmSlotId,
        confirmedCustomDate: useCustom ? customDate : null,
        confirmedCustomStart: useCustom ? customStart : null,
        confirmedCustomEnd: useCustom ? customEnd : null,
        confirmedAt: new Date().toISOString(),
      },
      {
        onSuccess: () => toast.success("Meeting confirmed — notifications sent"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not confirm"),
      },
    );
  };

  const cancel = () => {
    updateEvent.mutate(
      { id: event.id, status: "cancelled", closedAt: new Date().toISOString() },
      {
        onSuccess: () => toast.message("Event cancelled — participants notified"),
        onError: () => toast.error("Could not cancel"),
      },
    );
  };

  const close = () => {
    updateEvent.mutate(
      { id: event.id, status: "closed", closedAt: new Date().toISOString() },
      {
        onSuccess: () => toast.message("Event closed"),
        onError: () => toast.error("Could not close"),
      },
    );
  };

  const extend = () => {
    const next = new Date(event.deadline);
    next.setDate(next.getDate() + 3);
    updateEvent.mutate(
      { id: event.id, deadline: next.toISOString() },
      {
        onSuccess: () => toast.success("Deadline extended by 3 days"),
        onError: () => toast.error("Could not extend"),
      },
    );
  };

  const remove = () => {
    deleteEvent.mutate(
      { id: event.id },
      {
        onSuccess: () => {
          toast.message("Event deleted");
          navigate({ to: "/dashboard" });
        },
        onError: () => toast.error("Could not delete"),
      },
    );
  };

  const resend = () => {
    sendReminder.mutate(
      { eventId: event.id },
      {
        onSuccess: (r: { sent: number }) =>
          toast.success(
            `Reminder sent to ${r.sent} outstanding participant${r.sent === 1 ? "" : "s"}`,
          ),
        onError: () => toast.error("Could not send reminder"),
      },
    );
  };

  const invite = () => {
    sendInvitations.mutate(
      { eventId: event.id },
      {
        onSuccess: (r: { sent: number }) =>
          toast.success(
            `Invitation${r.sent === 1 ? "" : "s"} sent to ${r.sent} participant${r.sent === 1 ? "" : "s"}`,
          ),
        onError: () => toast.error("Could not send invitations"),
      },
    );
  };

  const target =
    event.participationMode === "named"
      ? event.namedParticipants.length
      : (event.minimumCount ?? 0);
  const responded = event.responses.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to dashboard
      </Link>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
              {event.title}
            </h1>
            <StatusBadge status={status} />
          </div>
          {event.description && (
            <p className="mt-2 max-w-2xl text-muted-foreground">{event.description}</p>
          )}
          {event.location && (
            <p className="mt-1 text-sm text-muted-foreground">📍 {event.location}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copyLink}>
            <Copy className="size-4" />
            Copy link
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowChat((s) => !s)}>
            <MessageSquare className="size-4" />
            Chat
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Responses"
          value={`${responded}${target ? `/${target}` : ""}`}
          icon={<Users className="size-4" />}
        />
        <Stat
          label="Deadline"
          value={status === "expired" ? "Expired" : relativeDeadline(event.deadline)}
          icon={<Clock className="size-4" />}
        />
        <Stat
          label="Best time"
          value={best ? toSlotLabel(best.date, best.startTime, best.endTime) : "—"}
          icon={<CheckCircle2 className="size-4" />}
          accent
        />
      </div>

      {showChat && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-premium">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <p className="text-sm font-medium text-foreground">Event chat</p>
            <button
              type="button"
              onClick={() => setShowChat(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close chat"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="h-80">
            <EventChat
              event={event}
              asOrganiser
              authorName={`${account.firstName} ${account.lastName}`}
              authorEmail={account.email}
            />
          </div>
        </div>
      )}

      {warning && <LimitBanner warning={warning} />}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <SectionTitle>Availability</SectionTitle>
          {status === "confirmed" ? (
            <ConfirmedView event={event} />
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Tap a slot to select it for confirmation. Shading shows how many participants are
                available.
              </p>
              <AvailabilityHeatMap
                event={event}
                selectedSlotId={confirmSlotId}
                onSelect={setConfirmSlotId}
              />
              <div className="mt-6 rounded-xl border border-border/70 bg-card p-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-card-foreground">
                  <input
                    type="checkbox"
                    checked={useCustom}
                    onChange={(e) => setUseCustom(e.target.checked)}
                    className="size-4 accent-[var(--color-primary)]"
                  />
                  Use a different time (not one of the proposed slots)
                </label>
                {useCustom && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="text-xs font-semibold text-card-foreground">
                      Date
                      <input
                        type="date"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        className="mt-1 flex h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
                      />
                    </label>
                    <label className="text-xs font-semibold text-card-foreground">
                      Start
                      <input
                        type="time"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="mt-1 flex h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
                      />
                    </label>
                    <label className="text-xs font-semibold text-card-foreground">
                      End
                      <input
                        type="time"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="mt-1 flex h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
                      />
                    </label>
                  </div>
                )}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  onClick={confirm}
                  disabled={useCustom ? !customDate : !confirmSlotId}
                  className="shadow-premium"
                >
                  <Check className="size-4" />
                  Confirm {useCustom ? "custom time" : confirmSlotId ? "selected time" : ""}
                </Button>
                <Button variant="outline" onClick={extend}>
                  <Clock className="size-4" />
                  Extend deadline
                </Button>
                {event.participationMode === "named" && (
                  <Button variant="outline" onClick={resend}>
                    <Send className="size-4" />
                    Send reminder
                  </Button>
                )}
              </div>
            </>
          )}
        </section>

        <aside className="space-y-6">
          <section>
            <SectionTitle>Participants</SectionTitle>
            {event.participationMode === "named" ? (
              <NamedList event={event} respondedEmails={respondedEmails} />
            ) : (
              <OpenList event={event} />
            )}
          </section>

          <section>
            <SectionTitle>Share</SectionTitle>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {link}
                </span>
                <Button size="sm" variant="outline" onClick={copyLink}>
                  <Copy className="size-3.5" />
                </Button>
              </div>
              {event.participationMode === "named" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={invite}
                  disabled={sendInvitations.isPending}
                >
                  <Send className="size-3.5" />
                  Re-send invitations
                </Button>
              )}
            </div>
          </section>

          <section>
            <SectionTitle>Embed</SectionTitle>
            <EmbedPanel event={event} account={account} />
          </section>

          <section>
            <div className="flex flex-wrap gap-2">
              {status !== "confirmed" && (
                <Button variant="outline" onClick={close}>
                  Close without confirming
                </Button>
              )}
              <Button variant="outline" onClick={cancel}>
                <CalendarX className="size-4" />
                Cancel event
              </Button>
              <Button variant="destructive" onClick={remove}>
                <Trash2 className="size-4" />
                Delete
              </Button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ConfirmedView({ event }: { event: KlokkEvent }) {
  const label = confirmedTimeLabel(event);
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 shadow-glow">
      <div className="flex items-center gap-2 text-primary">
        <CheckCircle2 className="size-5" />
        <span className="font-medium">Meeting confirmed</span>
      </div>
      {label && <p className="mt-3 font-display text-xl font-semibold text-foreground">{label}</p>}
      {event.confirmedAt && (
        <p className="mt-1 text-sm text-muted-foreground">
          Confirmed {formatDateTime(event.confirmedAt)}
        </p>
      )}
      <p className="mt-4 text-sm text-muted-foreground">
        A confirmation has been sent to all {event.responses.length} participants who responded.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-card p-5 shadow-premium ${
        accent ? "border-accent/40" : "border-border"
      }`}
    >
      <div
        className={`inline-flex size-9 items-center justify-center rounded-lg ${
          accent ? "bg-accent/15 text-accent" : "bg-primary/10 text-primary"
        }`}
      >
        {icon}
      </div>
      <p className="mt-3 font-display text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </h2>
  );
}

function NamedList({
  event,
  respondedEmails,
}: {
  event: KlokkEvent;
  respondedEmails: Set<string>;
}) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {event.namedParticipants.map((p) => {
        const responded = respondedEmails.has(p.email.toLowerCase());
        const response = event.responses.find(
          (r) => r.email.toLowerCase() === p.email.toLowerCase(),
        );
        return (
          <li key={p.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar url={p.avatarUrl} firstName={p.firstName} lastName={p.lastName} size={36} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {p.firstName} {p.lastName}
                </p>
                <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                {response && (
                  <>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {response.slotIds.length} slot{response.slotIds.length === 1 ? "" : "s"} ·{" "}
                      {formatDate(response.submittedAt)}
                    </p>
                    {response.notes && (
                      <p className="mt-1 text-xs italic text-accent bg-surface/60 rounded px-2 py-1 border border-border/50">
                        "{response.notes}"
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                responded ? "bg-primary/10 text-primary" : "bg-surface-muted text-muted-foreground"
              }`}
            >
              {responded ? "Responded" : "Outstanding"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function OpenList({ event }: { event: KlokkEvent }) {
  if (event.responses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface/40 p-6 text-center text-sm text-muted-foreground">
        No responses yet. Share the link to start collecting availability.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {event.responses.map((r) => (
        <li key={r.id} className="flex items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar url={r.avatarUrl} firstName={r.firstName} lastName={r.lastName} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {r.firstName} {r.lastName}
              </p>
              <p className="truncate text-xs text-muted-foreground">{r.email}</p>
              {r.phone && (
                <p className="truncate text-xs text-muted-foreground">
                  <a href={`tel:${r.phone.replace(/[^+\d]/g, "")}`} className="hover:underline">
                    {r.phone}
                  </a>
                </p>
              )}
              {r.notes && (
                <p className="mt-1 text-xs italic text-accent bg-surface/60 rounded px-2 py-1 border border-border/50">
                  "{r.notes}"
                </p>
              )}
            </div>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {r.slotIds.length} slot{r.slotIds.length === 1 ? "" : "s"}
          </span>
        </li>
      ))}
    </ul>
  );
}
