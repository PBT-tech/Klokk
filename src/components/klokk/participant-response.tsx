import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KlokkLogo } from "@/components/klokk/logo";
import { AvatarUpload, Avatar } from "@/components/klokk/avatar";
import { useEventByToken, useMyResponse, useSubmitResponse } from "@/lib/klokk-hooks";
import { computeStatus } from "@/lib/klokk-store";
import {
  confirmedTimeLabel,
  formatDateTime,
  relativeDeadline,
  toSlotLabel,
} from "@/lib/klokk-format";
import { uploadParticipantAvatar } from "@/lib/klokk-avatars";
import { getEditToken, setEditToken } from "@/lib/klokk-edit-token";
import { buildTrackingPayload, postTrackingEvent } from "@/lib/klokk-tracking";

/**
 * The participant response screen. `token` is the event's secret link token, or an
 * embed token ("emb." prefix) when rendered inside an embedded widget.
 */
export function ParticipantResponseView({ token }: { token: string }) {
  const embedded = token.startsWith("emb.");
  const event = useEventByToken(token);
  const navigate = useNavigate();
  const submitResponse = useSubmitResponse();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  // F4: pre-fill prior submission by same email.
  const prior = useMyResponse(token, email);

  // Load the earlier slot selection once the prior response is found.
  useEffect(() => {
    if (!prior) return;
    if (selected.size === 0 && prior.slotIds.length > 0) setSelected(new Set(prior.slotIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prior]);

  if (!event) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mb-6 flex justify-center">
          <KlokkLogo />
        </div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Event not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This link may be invalid or the event may have been closed.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
        >
          Go home
        </Link>
      </div>
    );
  }

  const status = computeStatus(event);
  const closed =
    status === "cancelled" ||
    status === "closed" ||
    (status === "confirmed" && !event.confirmedSlotId && !event.confirmedCustom);

  if (status === "confirmed" && (event.confirmedSlotId || event.confirmedCustom)) {
    const label = confirmedTimeLabel(event);
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mb-6 flex justify-center">
          <KlokkLogo />
        </div>
        <div className="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="size-7" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-bold tracking-tight text-foreground">
          This meeting is confirmed
        </h1>
        {label && <p className="mt-3 font-display text-lg text-foreground">{label}</p>}
        {event.location && <p className="mt-1 text-sm text-muted-foreground">{event.location}</p>}
        <p className="mt-4 text-sm text-muted-foreground">
          The organiser has locked in a time. Check your inbox for the details.
        </p>
      </div>
    );
  }

  if (closed) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mb-6 flex justify-center">
          <KlokkLogo />
        </div>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          This event is closed
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The organiser has closed this event and is no longer collecting responses.
        </p>
      </div>
    );
  }

  const toggle = (slotId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slotId)) next.delete(slotId);
      else next.add(slotId);
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("Please fill in your name and email");
      return;
    }
    if (selected.size === 0) {
      toast.error("Select at least one time you're available");
      return;
    }
    try {
      const result = await submitResponse.mutateAsync({
        token,
        editToken: getEditToken(token, email),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        slotIds: [...selected],
        avatarUrl,
        notes: notes.trim() || undefined,
      });
      setSubmitted(true);
      if (result?.editToken) setEditToken(token, email, result.editToken);
      try {
        sessionStorage.setItem(
          `klokk-last-${token}`,
          JSON.stringify({ firstName: firstName.trim(), slotIds: [...selected] }),
        );
      } catch {
        /* storage unavailable — confirmation page falls back to generic text */
      }
      toast.success("Availability submitted");

      // Fire-and-forget CRM tracking — never blocks the participant flow.
      try {
        postTrackingEvent(
          buildTrackingPayload(
            "klokk-participant-response",
            "Klokk Participant Response",
            {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              email: email.trim(),
            },
            {
              first_name: "First name",
              last_name: "Last name",
              email: "Email",
            },
          ),
        );
      } catch {
        /* tracking is best-effort */
      }

      if (!embedded) {
        navigate({
          to: "/event/$token/confirmed",
          params: { token },
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit");
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 flex items-center justify-between">
        <KlokkLogo />
        <span className="text-xs text-muted-foreground">klokk.com</span>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-premium sm:p-8">
        <p className="text-xs font-medium uppercase tracking-wide text-accent">
          {event.participationMode === "named" ? "You're invited" : "Share your availability"}
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-card-foreground">
          {event.title}
        </h1>
        {event.description && (
          <p className="mt-2 text-sm text-card-foreground/80">{event.description}</p>
        )}
        {event.location && (
          <p className="mt-2 text-sm text-card-foreground/80">📍 {event.location}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" />
            Respond by {formatDateTime(event.deadline)} ({relativeDeadline(event.deadline)})
          </span>
        </div>

        {submitted ? (
          <div className="mt-8 rounded-xl border border-primary/30 bg-primary/5 p-6 text-center">
            <CheckCircle2 className="mx-auto size-8 text-primary" />
            <p className="mt-3 font-medium text-card-foreground">
              Thanks — we've got your availability.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              The organiser will confirm a time and email you the details.
            </p>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={submit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name">
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="bg-card text-card-foreground border-border placeholder:text-muted-foreground"
                />
              </Field>
              <Field label="Last name">
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="bg-card text-card-foreground border-border placeholder:text-muted-foreground"
                />
              </Field>
            </div>
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-card text-card-foreground border-border placeholder:text-muted-foreground"
              />
              {prior && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  We found a prior submission from this email — your previous selection is loaded
                  for editing.
                </p>
              )}
            </Field>
            <Field label="Mobile number (optional)">
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0412 345 678"
                className="bg-card text-card-foreground border-border placeholder:text-muted-foreground"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Optional. Shared with the organiser only. We don't send you SMS messages.
              </p>
            </Field>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-card-foreground">
                Profile photo (optional)
              </Label>
              <AvatarUpload
                currentUrl={avatarUrl}
                firstName={firstName}
                lastName={lastName}
                upload={(file) => uploadParticipantAvatar(token, file)}
                onUploaded={(url) => setAvatarUrl(url)}
                onRemove={() => setAvatarUrl(undefined)}
                label="Your photo"
                size={72}
              />
            </div>

            <div>
              <Label className="mb-3 block text-sm font-semibold text-card-foreground">
                When can you make it?
              </Label>
              {event.slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No time slots have been defined for this event.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {event.slots.map((s) => {
                    const on = selected.has(s.id);
                    const count = event.responses.filter((r) => r.slotIds.includes(s.id)).length;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggle(s.id)}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all ${
                          on
                            ? "border-primary/50 bg-primary/10 text-card-foreground shadow-glow"
                            : "border-border bg-background text-card-foreground hover:border-primary/30"
                        }`}
                      >
                        <span>
                          {toSlotLabel(s.date, s.startTime, s.endTime)}
                          {count > 0 && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {count} other{count === 1 ? "" : "s"}
                            </span>
                          )}
                        </span>
                        <span
                          className={`flex size-5 items-center justify-center rounded-md border ${
                            on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border"
                          }`}
                        >
                          {on && <Check className="size-3.5" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-semibold text-card-foreground">
                Add notes or dietary requirements (optional)
              </Label>
              <textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Can do Tuesday if by 3pm, vegetarian, or prefer online"
                className="flex min-h-[80px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-card-foreground shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Organisers see any notes alongside your chosen dates and times.
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              By submitting, you agree your name and email will be used to coordinate this meeting
              and shared with the organiser. They are deleted automatically: up to 90 days after the
              event is created on free plans, or 12 months after it closes on paid plans. See our{" "}
              <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link to="/terms" className="underline underline-offset-4 hover:text-foreground">
                Terms of Use
              </Link>
              .
            </p>

            <Button type="submit" className="w-full" size="lg">
              <Check className="size-4" />
              Submit availability
              <ArrowRight className="size-4" />
            </Button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        No account needed. Your details are only shared with the event organiser.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-card-foreground">{label}</Label>
      {children}
    </div>
  );
}
