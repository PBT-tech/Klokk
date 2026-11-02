import { createFileRoute } from "@tanstack/react-router";

import { Hero, Trust } from "@/components/klokk/landing-hero";
import { Features, HowItWorks, ParticipantShowcase } from "@/components/klokk/landing-sections";
import { CaseStudies } from "@/components/klokk/landing-case-studies";
import { CTA, Pricing } from "@/components/klokk/landing-pricing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Klokk — Find a time that works for everyone" },
      {
        name: "description",
        content:
          "Scheduling a meeting shouldn't take longer than the meeting. Klokk turns the back-and-forth into one link — no accounts for your people, and the best time surfaces itself.",
      },
      { property: "og:title", content: "Klokk — Premium meeting co-ordinator" },
      {
        property: "og:description",
        content:
          "Find a time that works for everyone — fast. One link, no accounts, the slot the most people can make lights up the second they tap it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div>
      <Hero />
      <Trust />
      <HowItWorks />
      <Features />
      <ParticipantShowcase />
      <CaseStudies />
      <Pricing />
      <CTA />
    </div>
  );
}
