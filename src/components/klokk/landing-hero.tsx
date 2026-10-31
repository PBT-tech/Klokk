import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";

function HeroPreview() {
  return (
    <div className="animate-fade-up mt-14 sm:mt-16">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-premium">
        <div className="flex items-center gap-2 border-b border-border/70 bg-surface/60 px-4 py-3">
          <span className="size-2.5 rounded-full bg-destructive/60" />
          <span className="size-2.5 rounded-full bg-accent/70" />
          <span className="size-2.5 rounded-full bg-primary/50" />
          <span className="ml-2 text-xs text-muted-foreground">klokk.com/event/strategy-sync</span>
        </div>
        <div className="grid gap-6 p-6 sm:grid-cols-5 sm:p-8">
          <div className="sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-accent">
              Q3 Strategy Sync
            </p>
            <h3 className="mt-2 font-display text-xl font-semibold text-foreground">
              Pick your slot
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Tap any time you can make. We'll find the moment that works for the whole team.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Mara", "Theo", "Priya", "Lars"].map((n) => (
                <span
                  key={n}
                  className="rounded-full px-2.5 py-1 text-xs text-color-foreground bg-destructive text-muted"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
          <div className="sm:col-span-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { d: "Tue", t: "9:00 AM", n: 3, max: 4 },
                { d: "Tue", t: "1:00 PM", n: 2, max: 4 },
                { d: "Wed", t: "9:00 AM", n: 4, max: 4, best: true },
                { d: "Wed", t: "3:00 PM", n: 1, max: 4 },
                { d: "Thu", t: "11:00 AM", n: 2, max: 4 },
                { d: "Thu", t: "4:00 PM", n: 0, max: 4 },
              ].map((s) => (
                <div
                  key={`${s.d}-${s.t}`}
                  className={`rounded-2xl border p-3.5 transition-all ${
                    s.best
                      ? "border-hero-best-border bg-hero-best-bg shadow-glow"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[13px] font-medium leading-none ${
                        s.best ? "text-hero-best-text" : "text-foreground"
                      }`}
                    >
                      {s.d} · {s.t}
                    </span>
                    {s.best && (
                      <span className="rounded-full bg-hero-best-badge px-2.5 py-1 text-[12.5px] font-semibold leading-none text-white shadow-xs">
                        Best
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted/60">
                      <div
                        className="h-full rounded-full bg-[#00D780]"
                        style={{ width: `${(s.n / s.max) * 100}%` }}
                      />
                    </div>
                    <span
                      className={`text-[12.5px] font-medium leading-none ${
                        s.best ? "text-hero-best-text/80" : "text-muted-foreground"
                      }`}
                    >
                      {s.n}/{s.max}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-[0.04]" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:pt-28 bg-brand-foreground">
        <div className="mx-auto max-w-3xl text-center">
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm font-medium text-muted-foreground backdrop-blur bg-destructive-foreground">
            <Sparkles className="size-3.5 text-accent" />
            Premium meeting co-ordinator, free to start
          </div>
          <h1 className="animate-fade-up mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight text-foreground text-balance sm:text-6xl">
            Find a time that works for{" "}
            <span className="relative whitespace-nowrap">
              <span className="bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">
                everyone
              </span>
            </span>
            <span className="text-foreground"> — fast.</span>
          </h1>
          <p className="animate-fade-up mx-auto mt-6 max-w-xl text-pretty text-lg text-hero-copy">
            Here's how scheduling usually goes: you send an email about meeting availability, people
            forget, you send a reminder, three people reply, you chase the rest, and by Friday the
            meeting's dead. Klokk kills that loop. One link, no accounts for your people, and the
            slot the most of them can make lights up the second they tap it. The meeting that was
            never going to happen — happens.
          </p>
          <div className="animate-fade-up mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-base font-medium text-primary-foreground shadow-premium transition-all hover:opacity-95 active:scale-[0.98] sm:w-auto"
            >
              Create a free event
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/signin"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-base font-medium text-foreground transition-colors hover:bg-surface sm:w-auto text-sidebar-primary"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-4 text-hero-sub text-sm font-bold text-sidebar-accent">
            Free · 3 events · up to 35 people per event · no card, no catch
          </p>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}

export function Trust() {
  const stats = [
    { label: "avg. time to gather every response", value: "< 2 min" },
    { label: "people per event, free trial", value: "35" },
    { label: "accounts your guests ever create", value: "0" },
  ];
  return (
    <section className="border-b border-border/60 bg-surface/40">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-px overflow-hidden rounded-none sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="px-6 py-8 text-center bg-muted">
            <p className="font-display text-3xl font-semibold text-foreground text-input">
              {s.value}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
