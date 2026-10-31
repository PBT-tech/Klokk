import { CalendarCheck, Clock, Link2, Mail, ShieldCheck, Users, Zap } from "lucide-react";

import { KlokkLogo } from "./logo";
import { SectionHeading } from "./section-heading";

export function HowItWorks() {
  const steps = [
    {
      icon: CalendarCheck,
      title: "Set up your event",
      body: "Drop in a title, pick the dates that might work, and set a deadline. Two minutes — three if you're being poetic about it.",
    },
    {
      icon: Link2,
      title: "Share one link",
      body: "Send your people a single link. No app, no sign-up, no 'create an account to vote.' They just tap the times they can make.",
    },
    {
      icon: Zap,
      title: "Confirm the best time",
      body: "Watch responses land live. Klokk surfaces the slot with the most overlap — so you confirm without a spreadsheet or a prayer.",
    },
  ];
  return (
    <section className="border-b border-border/60 bg-section-how-bg">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps to a meeting that actually happens"
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="relative rounded-2xl border border-border bg-card p-6 shadow-premium"
            >
              <span className="absolute right-5 top-5 font-display text-5xl font-bold text-border">
                {i + 1}
              </span>
              <div className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-how-title">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Features() {
  const features = [
    {
      icon: Users,
      title: "Named or open invites",
      body: "Need five specific people in the room? List them by name and watch who's responded — and who's gone quiet. Or just set a minimum count and let anyone chime in.",
    },
    {
      icon: Clock,
      title: "Live availability heat map",
      body: "Every response shades the grid in real time. The best time surfaces itself — no tallying, no squinting at a Doodle that half the team forgot to open.",
    },
    {
      icon: ShieldCheck,
      title: "Built for trust",
      body: "Calm, clean, quietly premium. Your people open the link and feel like they're using real software — not a free tool that's about to sell their email.",
    },
    {
      icon: Mail,
      title: "Branded notifications",
      body: "Invitations, reminders, and confirmations — all in one elegant, mobile-optimised template with your event details front and centre. They actually get read.",
    },
  ];
  return (
    <section className="border-b border-border/60 bg-section-why-bg text-section-why-text">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrowClassName="uppercase tracking-[0.18em] font-bold text-lg text-section-eyebrow"
          eyebrow="Why Klokk"
          title="The details we obsessed over so scheduling stops being a chore"
          titleClassName="text-section-why-text"
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex gap-5 rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition-all hover:border-border hover:shadow-premium"
            >
              <div className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent dark:bg-accent/15 dark:text-accent">
                <f.icon className="size-6 stroke-[1.75]" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-lg font-bold tracking-tight text-features-title">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ParticipantShowcase() {
  return (
    <section className="border-b border-border/60 bg-section-participants-bg text-section-participants-text">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="For participants"
              title="A link they'll actually open"
              align="left"
              titleClassName="text-section-participants-text"
            />
            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-section-participants-text">
              No app to download, no account to create, no 'verify your email to continue.' Your
              people open the link, tap the times they can make, and they're done — usually under a
              minute, on the device already in their hand.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Works beautifully on mobile",
                "One-tap availability selection",
                "Instant confirmation of submission",
                "Final time sent straight to their inbox",
              ].map((t) => (
                <li key={t} className="flex items-center gap-3 text-[14px]">
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3" aria-hidden>
                      <path
                        fillRule="evenodd"
                        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <span className="text-section-participants-text">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-premium sm:p-8">
            <div className="flex items-center justify-between border-b border-border/70 pb-4">
              <KlokkLogo showWordmark={false} />
              <span className="text-xs text-muted-foreground">klokk.com</span>
            </div>
            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-accent">
                Q3 Strategy Sync
              </p>
              <h3 className="mt-1 font-display text-xl font-semibold text-foreground">
                When can you make it?
              </h3>
              <div className="mt-4 space-y-2">
                {[
                  { d: "Tue 9:00 AM", on: true },
                  { d: "Tue 1:00 PM", on: false },
                  { d: "Wed 9:00 AM", on: true },
                ].map((s) => (
                  <button
                    key={s.d}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                      s.on
                        ? "border-primary/40 bg-primary/10 text-participant-time"
                        : "border-border bg-background text-participant-time"
                    }`}
                  >
                    {s.d}
                    <span
                      className={`size-4 rounded-md border ${
                        s.on ? "border-primary bg-primary text-primary-foreground" : "border-border"
                      }`}
                    >
                      {s.on && (
                        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
                          <path
                            fillRule="evenodd"
                            d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
