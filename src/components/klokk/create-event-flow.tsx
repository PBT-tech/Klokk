import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Link2,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CREATE_STEPS, emptyDraft, sortSlots, toLocalInput, type Draft } from "@/lib/klokk-create";
import { SlotsStep } from "./create-event-slots";
import { Avatar, AvatarUpload } from "@/components/klokk/avatar";
import { cryptoId, makeToken } from "@/lib/klokk-store";
import { uploadParticipantAvatar } from "@/lib/klokk-avatars";
import { useCreateEvent } from "@/lib/klokk-hooks";
import { toSlotLabel } from "@/lib/klokk-format";
import { participantCapForPlan } from "@/lib/klokk-limits";
import type { KlokkAccount, KlokkEvent, NamedParticipant } from "@/lib/klokk-types";

export function CreateEventFlow({ account }: { account: KlokkAccount }) {
  const navigate = useNavigate();
  const createEvent = useCreateEvent();
  const [step, setStep] = useState(0);
  const [created, setCreated] = useState<KlokkEvent | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const canProceed = useMemo(() => {
    switch (step) {
      case 0:
        return draft.title.trim().length > 0;
      case 1:
        return draft.slots.length > 0;
      case 2:
        return draft.participationMode === "minimum"
          ? draft.minimumCount > 0
          : draft.namedParticipants.length > 0;
      case 3:
        return !!draft.deadline;
      default:
        return true;
    }
  }, [step, draft]);

  if (created) return <CreatedView event={created} />;

  const submit = async () => {
    if (!account.emailVerified) {
      toast.error("Verify your email before creating an event");
      setStep(0);
      return;
    }
    try {
      const created = await createEvent.mutateAsync({
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        location: draft.location.trim() || undefined,
        participationMode: draft.participationMode,
        minimumCount: draft.participationMode === "minimum" ? draft.minimumCount : undefined,
        deadline: draft.deadline,
        slots: draft.slots.map((s) => ({
          id: s.id,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
        namedParticipants:
          draft.participationMode === "named"
            ? draft.namedParticipants.map((p) => ({
                id: p.id,
                firstName: p.firstName,
                lastName: p.lastName,
                email: p.email,
                avatarUrl: p.avatarUrl,
              }))
            : [],
      });
      setCreated(created);
      toast.success("Event created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create event");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground shadow-xs transition-colors hover:bg-surface"
      >
        <ArrowLeft className="size-4 text-card-foreground" />
        Back to dashboard
      </Link>

      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-chart-4">
        Create an event
      </h1>

      <Stepper step={step} />

      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-premium sm:p-8">
        {step === 0 && <DetailsStep draft={draft} set={set} />}
        {step === 1 && <SlotsStep draft={draft} set={set} />}
        {step === 2 && (
          <ParticipantsStep draft={draft} set={set} cap={participantCapForPlan(account.plan)} />
        )}
        {step === 3 && <DeadlineStep draft={draft} set={set} />}
        {step === 4 && <ReviewStep draft={draft} />}

        <div className="mt-8 flex items-center justify-between border-t border-border/70 pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="border-border bg-background text-foreground font-semibold hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="size-4 text-foreground" />
            Back
          </Button>
          {step < CREATE_STEPS.length - 1 ? (
            <Button
              onClick={() => setStep((s) => Math.min(CREATE_STEPS.length - 1, s + 1))}
              disabled={!canProceed}
            >
              Continue
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              onClick={submit}
              disabled={!canProceed || createEvent.isPending}
              className="shadow-premium"
            >
              <Check className="size-4" />
              Generate link
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mt-6 flex flex-wrap gap-2">
      {CREATE_STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
              i <= step
                ? "bg-primary text-primary-foreground"
                : "bg-surface-muted text-muted-foreground"
            }`}
          >
            {i < step ? <Check className="size-3.5" /> : i + 1}
          </span>
          <span
            className={`text-sm ${
              i === step ? "font-medium text-card-foreground" : "text-muted-foreground"
            }`}
          >
            {label}
          </span>
          {i < CREATE_STEPS.length - 1 && (
            <span className="mx-1 hidden h-px w-6 bg-border sm:block" />
          )}
        </li>
      ))}
    </ol>
  );
}

function DetailsStep({
  draft,
  set,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title" className="text-sm font-semibold text-card-foreground">
          Event title <span className="text-accent">*</span>
        </Label>
        <Input
          id="title"
          placeholder="e.g. Canberra Business Women Lunch"
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          className="bg-card text-card-foreground border-border placeholder:text-muted-foreground"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="desc" className="text-sm font-semibold text-card-foreground">
          Meeting description / details (optional)
        </Label>
        <Textarea
          id="desc"
          rows={3}
          placeholder="What's this meeting about? Add agenda, expectations, or background details."
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          className="bg-card text-card-foreground border-border placeholder:text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground">
          Share background context, goals, or discussion topics so invitees know what to expect.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="controlloc" className="text-sm font-semibold text-card-foreground">
          Meeting location or link (optional)
        </Label>
        <Input
          id="controlloc"
          placeholder="e.g. The Ottoman Restaurant, Studio B · 4th Floor, or Zoom link"
          value={draft.location}
          onChange={(e) => set("location", e.target.value)}
          className="bg-card text-card-foreground border-border placeholder:text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground">
          Venue name, street address, or video call link (Zoom, Google Meet, Teams).
        </p>
      </div>
    </div>
  );
}

function ParticipantsStep({
  draft,
  set,
  cap,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  /** hard participant cap for the organiser's plan, or null when there is none */
  cap: number | null;
}) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-3 block text-card-foreground">Participation requirement</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeCard
            active={draft.participationMode === "minimum"}
            onClick={() => set("participationMode", "minimum")}
            title="Minimum count"
            body="Event is ready to confirm once at least N people respond."
          />
          <ModeCard
            active={draft.participationMode === "named"}
            onClick={() => set("participationMode", "named")}
            title="Named list"
            body="Track responses against a specific list of required participants."
          />
        </div>
      </div>

      {draft.participationMode === "minimum" ? (
        <div className="space-y-1.5">
          <Label htmlFor="min" className="text-card-foreground">
            Minimum participants
          </Label>
          <Input
            id="min"
            type="number"
            min={1}
            max={cap ?? undefined}
            value={draft.minimumCount}
            onChange={(e) =>
              set("minimumCount", Math.max(1, Math.min(cap ?? 100000, Number(e.target.value) || 1)))
            }
            className="max-w-xs"
          />
          <p className="text-xs text-muted-foreground">
            Free trial: up to 35 participants per event (hard cap). Casual packs: 35 included with
            overage blocks available. Organiser: up to 80. Teams: unlimited.
          </p>
        </div>
      ) : (
        <NamedList draft={draft} set={set} cap={cap} />
      )}
    </div>
  );
}

function NamedList({
  draft,
  set,
  cap,
}: {
  cap: number | null;
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");

  const add = () => {
    if (!first.trim() || !last.trim() || !email.trim()) {
      toast.error("Fill in name and email");
      return;
    }
    if (cap !== null && draft.namedParticipants.length >= cap) {
      toast.error(
        `Participant limit reached (maximum ${cap} on your plan${cap === 35 ? "; Casual and Organiser allow more" : "; Teams is unlimited"})`,
      );
      return;
    }
    const p: NamedParticipant = {
      id: cryptoId(),
      firstName: first.trim(),
      lastName: last.trim(),
      email: email.trim(),
    };
    set("namedParticipants", [...draft.namedParticipants, p]);
    setFirst("");
    setLast("");
    setEmail("");
  };

  const addAvatar = (id: string, url: string) =>
    set(
      "namedParticipants",
      draft.namedParticipants.map((p) => (p.id === id ? { ...p, avatarUrl: url } : p)),
    );

  const removeAvatar = (id: string) =>
    set(
      "namedParticipants",
      draft.namedParticipants.map((p) => (p.id === id ? { ...p, avatarUrl: undefined } : p)),
    );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
        <Input placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
        <Input placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {draft.namedParticipants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-6 text-center text-sm text-muted-foreground">
          Add the people whose availability you need. Free trial includes up to 35 participants.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {draft.namedParticipants.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar url={p.avatarUrl} firstName={p.firstName} lastName={p.lastName} size={36} />
                <div>
                  <p className="text-sm font-medium text-card-foreground">
                    {p.firstName} {p.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <AvatarUpload
                  currentUrl={p.avatarUrl}
                  firstName={p.firstName}
                  lastName={p.lastName}
                  upload={(file) => uploadParticipantAvatar(draft.title || "draft", file)}
                  onUploaded={(url) => addAvatar(p.id, url)}
                  onRemove={() => removeAvatar(p.id)}
                  label=""
                  size={32}
                />
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "namedParticipants",
                      draft.namedParticipants.filter((x) => x.id !== p.id),
                    )
                  }
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove"
                >
                  <X className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-all ${
        active
          ? "border-primary/50 bg-primary/5 shadow-glow"
          : "border-border bg-background hover:bg-surface"
      }`}
    >
      <div
        className={`inline-flex size-9 items-center justify-center rounded-lg ${
          active ? "bg-primary/10 text-primary" : "bg-surface-muted text-muted-foreground"
        }`}
      >
        <Users className="size-4" />
      </div>
      <p className="mt-3 font-medium text-card-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </button>
  );
}

function DeadlineStep({
  draft,
  set,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="deadline" className="text-card-foreground">
          Response deadline
        </Label>
        <Input
          id="deadline"
          type="datetime-local"
          value={toLocalInput(new Date(draft.deadline))}
          onChange={(e) => {
            if (e.target.value) set("deadline", new Date(e.target.value).toISOString());
          }}
          className="text-card-foreground"
        />
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-border bg-surface/50 p-4">
        <Clock className="mt-0.5 size-4 shrink-0 text-accent" />
        <p className="text-sm text-muted-foreground">
          After this deadline, the event is marked expired. You can still confirm from collected
          responses, or extend the deadline at any time.
        </p>
      </div>
    </div>
  );
}

function ReviewStep({ draft }: { draft: Draft }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-semibold text-card-foreground">
          {draft.title || "Untitled event"}
        </h3>
        {draft.description && (
          <p className="mt-1 text-sm text-muted-foreground">{draft.description}</p>
        )}
        {draft.location && (
          <p className="mt-2 text-sm text-muted-foreground">📍 {draft.location}</p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ReviewBlock label="Time slots">
          {draft.slots.length === 0 ? (
            <span className="text-sm text-muted-foreground">None</span>
          ) : (
            <ul className="space-y-1 text-sm text-card-foreground">
              {draft.slots.map((s) => (
                <li key={s.id}>{toSlotLabel(s.date, s.startTime, s.endTime)}</li>
              ))}
            </ul>
          )}
        </ReviewBlock>
        <ReviewBlock label="Participants">
          {draft.participationMode === "minimum" ? (
            <p className="text-sm text-card-foreground">Minimum {draft.minimumCount} responses</p>
          ) : (
            <p className="text-sm text-card-foreground">
              {draft.namedParticipants.length} named participants
            </p>
          )}
        </ReviewBlock>
      </div>
      <ReviewBlock label="Deadline">
        <p className="text-sm text-card-foreground">{new Date(draft.deadline).toLocaleString()}</p>
      </ReviewBlock>
    </div>
  );
}

function ReviewBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function CreatedView({ event }: { event: KlokkEvent }) {
  const navigate = useNavigate();
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/event/${event.token}`;

  const copy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(link).then(
        () => toast.success("Link copied"),
        () => toast.error("Couldn't copy"),
      );
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <div className="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-accent/15 text-accent">
        <CheckCircle2 className="size-7" />
      </div>
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-foreground">
        Your event is ready
      </h1>
      <p className="mt-2 text-muted-foreground">
        Share this link with your participants. No account needed for them.
      </p>
      <div className="mt-8 flex items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-premium">
        <Link2 className="ml-1 size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-left text-sm text-card-foreground">
          {link}
        </span>
        <Button size="sm" variant="outline" onClick={copy}>
          <Copy className="size-3.5" />
          Copy
        </Button>
      </div>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button
          variant="outline"
          onClick={() => navigate({ to: "/event/$token", params: { token: event.token } })}
        >
          <CalendarDays className="size-4" />
          Preview participant view
        </Button>
        <Button
          onClick={() => navigate({ to: "/events/$id", params: { id: event.id } })}
          className="shadow-premium"
        >
          Go to event
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
