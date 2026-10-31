import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarPlus, CalendarX, CheckCircle2, Clock, Plus, Users } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/klokk/status-badge";
import { Avatar } from "@/components/klokk/avatar";
import { useCurrentAccount, useOwnedEvents, useSession } from "@/lib/klokk-hooks";
import { computeStatus } from "@/lib/klokk-store";
import { formatDateShort, relativeDeadline, daysUntil } from "@/lib/klokk-format";
import type { KlokkEvent } from "@/lib/klokk-types";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Klokk" },
      {
        name: "description",
        content: "Manage your Klokk scheduling events.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const session = useSession();
  const account = useCurrentAccount();
  const events = useOwnedEvents();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) navigate({ to: "/signin" });
  }, [session, navigate]);

  if (!session || !account) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  const computed = events.map((e) => ({ event: e, status: computeStatus(e) }));
  const active = computed.filter(
    (c) =>
      c.status === "awaiting_responses" ||
      c.status === "ready_to_confirm" ||
      c.status === "expired",
  );
  const confirmed = computed.filter((c) => c.status === "confirmed");
  const closed = computed.filter((c) => c.status === "cancelled" || c.status === "closed");

  const totalResponses = events.reduce((n, e) => n + e.responses.length, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar
            url={account.avatarUrl}
            firstName={account.firstName}
            lastName={account.lastName}
            size={56}
            className="ring-2 ring-border"
          />
          <div>
            <p className="text-sm text-muted-foreground">Welcome back</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
              {account.firstName}'s events
            </h1>
          </div>
        </div>
        <Link to="/events/new">
          <Button size="lg" className="shadow-premium">
            <CalendarPlus className="size-4" />
            New event
          </Button>
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard icon={<Clock className="size-4" />} label="Active events" value={active.length} />
        <StatCard
          icon={<Users className="size-4" />}
          label="Total responses"
          value={totalResponses}
        />
        <StatCard
          icon={<CheckCircle2 className="size-4" />}
          label="Confirmed"
          value={confirmed.length}
        />
      </div>

      <div className="mt-10">
        <SectionTitle>Active</SectionTitle>
        {active.length === 0 ? (
          <EmptyState
            title="No active events"
            body="Create your first event and share the link to start collecting availability."
            cta
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((c) => (
              <EventCard key={c.event.id} event={c.event} status={c.status} />
            ))}
          </div>
        )}
      </div>

      {confirmed.length > 0 && (
        <div className="mt-12">
          <SectionTitle>Confirmed</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {confirmed.map((c) => (
              <EventCard key={c.event.id} event={c.event} status={c.status} />
            ))}
          </div>
        </div>
      )}

      {closed.length > 0 && (
        <div className="mt-12">
          <SectionTitle>Closed</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {closed.map((c) => (
              <EventCard key={c.event.id} event={c.event} status={c.status} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-premium">
      <div className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <p className="font-display text-2xl font-bold text-card-foreground">{value}</p>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-[0.14em] text-foreground/80">
      {children}
    </h2>
  );
}

function EventCard({
  event,
  status,
}: {
  event: KlokkEvent;
  status: ReturnType<typeof computeStatus>;
}) {
  const responded = event.responses.length;
  const target =
    event.participationMode === "named"
      ? event.namedParticipants.length
      : (event.minimumCount ?? 0);
  const dd = daysUntil(event.deadline);
  const nearDeletion = status === "confirmed" && event.closedAt && daysUntil(event.closedAt) > 76;

  return (
    <Link
      to="/events/$id"
      params={{ id: event.id }}
      className="group block rounded-2xl border border-border bg-card p-5 shadow-premium transition-all hover:border-primary/30 hover:shadow-glow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-semibold text-card-foreground">
            {event.title}
          </h3>
          {event.location && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{event.location}</p>
          )}
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Users className="size-3.5" />
          {responded}
          {target > 0 ? `/${target}` : ""} responded
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-3.5" />
          {status === "expired" ? "Expired" : relativeDeadline(event.deadline)}
        </span>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{
            width: `${target > 0 ? Math.min(100, (responded / target) * 100) : 0}%`,
          }}
        />
      </div>

      {nearDeletion && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
          <CalendarX className="size-3.5" />
          Scheduled for deletion in {90 - (daysUntil(event.closedAt!) ?? 0)}d
        </p>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>Created {formatDateShort(event.createdAt)}</span>
        <span className="font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Manage →
        </span>
      </div>
    </Link>
  );
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta?: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/70 p-10 text-center">
      <div className="mx-auto inline-flex size-12 items-center justify-center rounded-xl bg-surface-muted text-card-foreground">
        <Plus className="size-5" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-card-foreground">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{body}</p>
      {cta && (
        <Link to="/events/new">
          <Button className="mt-5">
            <CalendarPlus className="size-4" />
            Create your first event
          </Button>
        </Link>
      )}
    </div>
  );
}
