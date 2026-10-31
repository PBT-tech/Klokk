import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

import { EventManagement } from "@/components/klokk/event-management";
import { useCurrentAccount, useEventById, useSession } from "@/lib/klokk-hooks";

export const Route = createFileRoute("/events/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Manage event — Klokk" },
      {
        name: "description",
        content: "Manage your scheduling event, view responses, and confirm a time.",
      },
    ],
  }),
  component: EventManagementRoute,
});

function EventManagementRoute() {
  const { id } = Route.useParams();
  const session = useSession();
  const account = useCurrentAccount();
  const event = useEventById(id);
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) navigate({ to: "/signin" });
  }, [session, navigate]);

  if (!session) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  if (!account) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center text-muted-foreground">
        Account not found.
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-foreground">Event not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This event may have been deleted.</p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (event.ownerId !== account.id) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-foreground">Not your event</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have access to manage this event.
        </p>
      </div>
    );
  }

  return <EventManagement event={event} account={account} />;
}
