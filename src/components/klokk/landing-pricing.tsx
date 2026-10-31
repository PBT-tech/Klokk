import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { SectionHeading } from "./section-heading";

export function Pricing() {
  return (
    <section className="border-b border-border/60 bg-surface/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 bg-pricing-bg">
        <SectionHeading
          eyebrowClassName="uppercase tracking-[0.18em] font-bold text-lg text-section-eyebrow"
          eyebrow="Pricing"
          title="Simple, transparent plans designed to scale"
        />
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-pricing-subtext font-semibold">
          Start with 3 free events, buy credit packs as needed, or subscribe for unlimited
          scheduling.
        </p>

        {/* 4 Plans Grid */}
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Free (Trial) */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div>
              <div className="inline-flex rounded-full bg-surface px-2.5 py-0.5 text-sm font-medium text-muted-foreground">
                Free (Trial)
              </div>
              <p className="mt-3 font-display text-4xl font-bold text-pricing-amount">$0</p>
              <p className="mt-1 text-sm text-muted-foreground">3 lifetime events total</p>
              <div className="my-5 h-px bg-border/70" />
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-pricing-bullet font-medium">✓</span>
                  <span>
                    <strong>3 lifetime events</strong> total
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pricing-bullet font-medium">✓</span>
                  <span>
                    <strong>35 participants</strong> per event (hard cap)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pricing-bullet font-medium">✓</span>
                  <span>1 organiser seat</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pricing-bullet font-medium">✓</span>
                  <span>Live availability heat map</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pricing-bullet font-medium">✓</span>
                  <span>Branded email notifications</span>
                </li>
              </ul>
            </div>
            <div className="mt-6 pt-4 border-t border-border/50">
              <Link
                to="/signup"
                className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-background py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface hover:text-btn-hover-text"
              >
                Start free trial
              </Link>
            </div>
          </div>

          {/* Casual (Credit Packs) */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div>
              <div className="inline-flex rounded-full bg-surface px-2.5 py-0.5 text-sm font-medium text-muted-foreground">
                Casual (Credit Packs)
              </div>
              <p className="mt-3 font-display text-3xl font-bold text-pricing-amount">From $25</p>
              <p className="mt-1 text-sm text-muted-foreground">Pay as you schedule</p>
              <div className="my-5 h-px bg-border/70" />
              <div className="rounded-lg bg-surface/70 p-2.5 text-sm space-y-1 mb-4 border border-border/50">
                <div className="flex justify-between font-medium text-casual-block-row">
                  <span>5 events</span>
                  <span className="font-semibold">$25</span>
                </div>
                <div className="flex justify-between text-casual-block-row">
                  <span>10 events</span>
                  <span className="font-semibold">$45</span>
                </div>
                <div className="flex justify-between text-casual-block-row">
                  <span>15 events</span>
                  <span className="font-semibold">$60</span>
                </div>
              </div>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-pricing-bullet font-medium">✓</span>
                  <span>
                    Credits expire <strong>3 months</strong> from purchase
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pricing-bullet font-medium">✓</span>
                  <span>
                    <strong>35 participants</strong> included per event
                  </span>
                </li>
                <li className="flex items-start gap-2 text-accent">
                  <span className="font-medium">+</span>
                  <span>If you need to invite more participants - in blocks of 5</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pricing-bullet font-medium">✓</span>
                  <span>1 organiser seat</span>
                </li>
              </ul>
            </div>
            <div className="mt-6 pt-4 border-t border-border/50">
              <Link
                to="/signup"
                className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-background py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface hover:text-btn-hover-text"
              >
                Buy a credit pack
              </Link>
            </div>
          </div>

          {/* Organiser (Subscription) */}
          <div className="relative flex flex-col justify-between rounded-2xl border-2 border-popular-panel-border bg-card p-6 shadow-glow">
            <span className="absolute -top-3 right-5 rounded-full bg-popular-badge-bg px-2.5 py-0.5 text-sm font-semibold text-popular-badge-text shadow-sm">
              Popular
            </span>
            <div>
              <div className="inline-flex rounded-full bg-accent/15 px-2.5 py-0.5 text-sm font-semibold text-accent">
                Organiser
              </div>
              <p className="mt-3 font-display text-4xl font-bold text-foreground text-ring text-pricing-popular">
                $17 pm
              </p>
              <p className="mt-1 text-sm text-muted-foreground">(billed monthly or annually)</p>
              <p className="mt-0.5 text-sm font-medium text-accent">
                Annual: 2 months free (pay 10, get 12)
              </p>
              <div className="my-5 h-px bg-border/70" />
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-accent font-medium">✓</span>
                  <span className="text-accent font-medium">Unlimited events</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent font-medium">✓</span>
                  <span>
                    <strong>Up to 80 participants</strong> per event
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent font-medium">✓</span>
                  <span>1 organiser seat</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent font-medium">✓</span>
                  <span>Real-time availability heat map</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent font-medium">✓</span>
                  <span>Event chat (P12) &amp; embed widget</span>
                </li>
              </ul>
            </div>
            <div className="mt-6 pt-4 border-t border-border/50">
              <Link
                to="/signup"
                className="inline-flex w-full items-center justify-center rounded-xl bg-popular-badge-bg py-2 text-sm font-semibold text-popular-badge-text shadow-sm transition-all hover:bg-organiser-hover-bg hover:text-organiser-hover-text"
              >
                Get Organiser
              </Link>
            </div>
          </div>

          {/* Teams */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div>
              <div className="inline-flex rounded-full bg-surface px-2.5 py-0.5 text-sm font-medium text-muted-foreground">
                Teams
              </div>
              <p className="mt-3 font-display text-4xl font-bold text-pricing-amount">$35 pm</p>
              <p className="mt-1 text-sm text-muted-foreground">
                base plan + $8 pm each extra organiser
              </p>
              <p className="mt-0.5 text-sm font-medium text-accent">
                Annual: 2 months free (pay 10, get 12)
              </p>
              <div className="my-5 h-px bg-border/70" />
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-pricing-bullet font-medium">✓</span>
                  <span>
                    <strong>Base includes 3 organiser seats</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pricing-bullet font-medium">✓</span>
                  <span>
                    <strong>Unlimited events</strong> per organiser
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pricing-bullet font-medium">✓</span>
                  <span>
                    <strong>Unlimited participants</strong> per event
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pricing-bullet font-medium">✓</span>
                  <span>Shared workspace &amp; team coordination</span>
                </li>
              </ul>
            </div>
            <div className="mt-6 pt-4 border-t border-border/50">
              <Link
                to="/signup"
                className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-background py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface hover:text-btn-hover-text"
              >
                Go with Teams
              </Link>
            </div>
          </div>
        </div>

        {/* Casual Participant Overage Explainer Callout */}
        <div className="mt-10 rounded-2xl border border-border/80 bg-card p-6 shadow-sm sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-sm font-semibold text-accent">
                  Casual Plan
                </span>
                <h4 className="font-display text-base font-semibold text-foreground">
                  Participant Overage on Casual Packs
                </h4>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-2xl">
                Charged per event, per block of 5 additional participants above the 35 included.
                Overage is calculated per individual event, not accumulated across account or pack:
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className="rounded-xl border border-border bg-surface/50 p-3 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  1–3 Blocks (36–50 guests)
                </p>
                <p className="mt-1 font-display text-lg font-bold text-casual-block-price">
                  $6.20 each block
                </p>
                <p className="text-sm text-muted-foreground">5 participants per block</p>
              </div>
              <div className="rounded-xl border border-border bg-surface/50 p-3 text-center">
                <p className="text-sm font-medium text-muted-foreground">4+ Blocks (51+ guests)</p>
                <p className="mt-1 font-display text-lg font-bold text-casual-block-price">
                  $5.30 each block
                </p>
                <p className="text-sm text-muted-foreground">5 participants per block</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CTA() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 bg-[#a6c3d7]">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center shadow-premium sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-accent/30 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-accent/20 blur-3xl"
          />
          <h2 className="relative font-display text-3xl font-bold tracking-tight text-primary-foreground text-balance sm:text-4xl">
            Stop scheduling the meeting. Just pick the time.
          </h2>
          <p className="relative mx-auto mt-4 max-w-md text-primary-foreground/80 mb-0">
            Create a free event in under a minute. No credit card, no commitment, no 14-day trial
            that quietly starts charging you.
          </p>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-base font-medium text-accent-foreground shadow-glow transition-all hover:opacity-95 active:scale-[0.98] sm:w-auto"
            >
              Create a free event
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/signin"
              className="inline-flex w-full items-center justify-center rounded-xl border border-primary-foreground/30 px-6 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/10 sm:w-auto border-sidebar-primary-foreground"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
