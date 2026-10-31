import { MessageSquare, TrendingUp, Users } from "lucide-react";

import { SectionHeading } from "./section-heading";

export function CaseStudies() {
  const cases = [
    {
      icon: MessageSquare,
      kicker: "8 people, one morning",
      title: "The kickoff that almost didn't happen",
      body: "Mara needed eight people on a project kickoff. She sent the Klokk link at 9:04am. By 9:31 every slot was filled. The meeting ran at 11 — and she didn't chase a single person.",
    },
    {
      icon: Users,
      kicker: "17 parents, four evenings",
      title: "The committee meeting without the group chat",
      body: "Theo was coordinating 17 parents across four possible evenings. No reply-all thread, no Doodle nobody checked. Klokk found the one slot 15 of them could actually make.",
    },
    {
      icon: TrendingUp,
      kicker: "From days to hours",
      title: "The sales team that stopped wasting Mondays",
      body: "A six-person sales team used to burn half of Monday just finding a time to talk. With Klokk, their average time-to-meeting dropped from four days to under two hours.",
    },
  ];
  return (
    <section className="border-b border-border/60 bg-section-cases-bg">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="It just works"
          title="Here's what scheduling looks like when it stops being a chore"
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {cases.map((c) => (
            <div
              key={c.title}
              className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-premium"
            >
              <div className="inline-flex size-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <c.icon className="size-5" />
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-accent">
                {c.kicker}
              </p>
              <h3 className="mt-1 font-display text-lg font-semibold text-case-title">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
