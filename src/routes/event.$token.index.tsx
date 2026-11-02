import { createFileRoute } from "@tanstack/react-router";

import { ParticipantResponseView } from "@/components/klokk/participant-response";

export const Route = createFileRoute("/event/$token/")({
  head: () => ({
    meta: [
      { title: "Respond to event — Klokk" },
      {
        name: "description",
        content: "Share your availability for this scheduling event.",
      },
    ],
  }),
  component: ParticipantResponse,
});

function ParticipantResponse() {
  const { token } = Route.useParams();
  return <ParticipantResponseView token={token} />;
}
