import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Klokk" },
      {
        name: "description",
        content: "How Klokk collects, uses and deletes personal information.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Link to="/" className="text-sm text-primary underline-offset-4 hover:underline">
        ← Back to Klokk
      </Link>
      <h1 className="mt-6 font-display text-3xl font-semibold text-foreground">Privacy Policy</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        Draft for legal review · Last updated 2 November 2026
      </p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Klokk is operated by Pegasus Apps (Canberra, Australia). We handle personal information in
          line with the Australian Privacy Principles under the Privacy Act 1988, and apply GDPR
          principles as best practice for participants in the EU.
        </p>
        <h2 className="pt-2 font-display text-lg font-semibold text-foreground">What we collect</h2>
        <p>
          Organisers: Email address, a hashed password and an optional display name. Participants:
          first name, last name, email address, an optional mobile number, availability selections
          and any notes you choose to add. We do not collect payment card details (payments are
          handled by our payment provider) or any sensitive categories of personal information.
        </p>
        <h2 className="pt-2 font-display text-lg font-semibold text-foreground">How we use it</h2>
        <p>
          Your details are used only to coordinate the meeting you were invited to, and to send
          related emails such as invitations, confirmations and reminders. They are shared with the
          event organiser and are not sold or shared with third parties for marketing.
        </p>
        <h2 className="pt-2 font-display text-lg font-semibold text-foreground">
          How long we keep it
        </h2>
        <p>
          Events on the free plan, with all their responses and participant details, are deleted
          automatically 90 days after the event is created. Events on paid plans are deleted 12
          months after the event closes. Organisers can delete their account at any time, which
          removes their events and data.
        </p>
        <h2 className="pt-2 font-display text-lg font-semibold text-foreground">Your rights</h2>
        <p>
          You can ask to access, correct or delete your personal information, or complain about how
          it has been handled, by contacting us at the address below. If you are not satisfied you
          may contact the Office of the Australian Information Commissioner.
        </p>
        <h2 className="pt-2 font-display text-lg font-semibold text-foreground">Data breaches</h2>
        <p>
          If a breach is likely to cause serious harm, we will notify affected people and the
          regulator as required by law.
        </p>
        <h2 className="pt-2 font-display text-lg font-semibold text-foreground">Contact</h2>
        <p>Pegasus Apps, Canberra, Australia.</p>
      </div>
    </div>
  );
}
