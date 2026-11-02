import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { CreateEventFlow } from "@/components/klokk/create-event-flow";
import { useCurrentAccount, useSession } from "@/lib/klokk-hooks";

export const Route = createFileRoute("/events/new")({
  head: () => ({
    meta: [
      { title: "Create an event — Klokk" },
      {
        name: "description",
        content: "Create a new scheduling event and share it with participants.",
      },
    ],
  }),
  component: CreateEvent,
});

function CreateEvent() {
  const session = useSession();
  const account = useCurrentAccount();
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

  return <CreateEventFlow account={account} />;
}
