import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — Klokk" },
      { name: "description", content: "The terms for using Klokk." },
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
      <h1 className="mt-6 font-display text-3xl font-semibold text-foreground">Terms of Use</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        Draft for legal review · Last updated 2 November 2026
      </p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          By using Klokk you agree to these terms. Klokk is provided by Pegasus Apps ("we", "us").
        </p>
        <h2 className="pt-2 font-display text-lg font-semibold text-foreground">The service</h2>
        <p>
          Klokk helps groups find a meeting time that works for most. Organisers create events and
          share a link; participants submit their availability without an account. Plans, prices and
          limits are described on our pricing page and may change with notice.
        </p>
        <h2 className="pt-2 font-display text-lg font-semibold text-foreground">Acceptable use</h2>
        <p>
          Do not misuse Klokk, attempt to access other people's events or data, send unsolicited
          bulk invitations, or use the service for anything unlawful. We may suspend accounts that
          breach these terms.
        </p>
        <h2 className="pt-2 font-display text-lg font-semibold text-foreground">
          Your content and data
        </h2>
        <p>
          Event data is deleted automatically according to the retention periods in our Privacy
          Policy. Deletion cannot be undone, so keep your own record of anything you need.
        </p>
        <h2 className="pt-2 font-display text-lg font-semibold text-foreground">Ownership</h2>
        <p>
          Klokk and its source code, design and branding are owned by Pegasus Apps. All rights are
          reserved.
        </p>
        <h2 className="pt-2 font-display text-lg font-semibold text-foreground">Liability</h2>
        <p>
          Klokk is provided "as is". To the extent permitted by Australian Consumer Law, we are not
          liable for missed meetings or indirect loss. Nothing in these terms excludes rights you
          have under that law.
        </p>
        <h2 className="pt-2 font-display text-lg font-semibold text-foreground">Contact</h2>
        <p>Pegasus Apps, Canberra, Australia.</p>
      </div>
    </div>
  );
}
