import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarPlus, CheckCircle2, Clock, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { KlokkFullLogo, KlokkLogo } from "@/components/klokk/logo";
import { useEventByToken } from "@/lib/klokk-hooks";
import { toSlotLabel } from "@/lib/klokk-format";

export const Route = createFileRoute("/event/$token/confirmed")({
  head: ({ params }) => ({
    meta: [
      { title: "Availability submitted — Klokk" },
      {
        name: "description",
        content: "Your availability has been submitted.",
      },
    ],
  }),
  component: SubmissionConfirmed,
});

function SubmissionConfirmed() {
  const { token } = Route.useParams();
  const event = useEventByToken(token);

  if (!event) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mb-6 flex justify-center">
          <KlokkLogo />
        </div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Event not found</h1>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
        >
          Go home
        </Link>
      </div>
    );
  }

  // Responses from other participants are never sent to this page, so the
  // participant's own submission is remembered in this browser session.
  let myResponse: { firstName?: string; slotIds: string[] } | undefined;
  try {
    const raw =
      typeof sessionStorage !== "undefined" ? sessionStorage.getItem(`klokk-last-${token}`) : null;
    if (raw) myResponse = JSON.parse(raw);
  } catch {
    myResponse = undefined;
  }
  const mySlots = event.slots.filter((s) => myResponse?.slotIds.includes(s.id));

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
      <div className="mb-6 flex justify-center">
        <KlokkFullLogo size="md" />
      </div>

      <div className="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-accent/15 text-accent">
        <CheckCircle2 className="size-7" />
      </div>

      <h1 className="mt-6 font-script text-3xl font-normal tracking-tight text-foreground text-balance">
        Thanks, {myResponse?.firstName ?? "there"} — you're all set.
      </h1>
      <p className="mt-3 text-muted-foreground">
        Your availability for <span className="font-medium text-foreground">{event.title}</span> has
        been submitted.
      </p>

      {mySlots.length > 0 && (
        <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-border bg-card p-5 text-left shadow-premium">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your selected times
          </p>
          <ul className="space-y-2">
            {mySlots.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm text-foreground">
                <Clock className="size-3.5 text-accent" />
                {toSlotLabel(s.date, s.startTime, s.endTime)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3 text-left">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface/50 p-4">
          <Mail className="mt-0.5 size-4 shrink-0 text-accent" />
          <p className="text-sm text-muted-foreground">
            We'll email you the confirmed time once the organiser locks it in. Keep an eye on your
            inbox.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <Link to="/">
          <Button variant="outline">
            <CalendarPlus className="size-4" />
            Back to Klokk
          </Button>
        </Link>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Want SMS reminders too? Ask the organiser about Klokk Pro.
      </p>
    </div>
  );
}
