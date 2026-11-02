import { AlertTriangle, Info } from "lucide-react";

import type { LimitWarning } from "@/lib/klokk-warnings";

/** On-screen version of a limit warning (the same text is emailed to the organiser). */
export function LimitBanner({ warning }: { warning: LimitWarning }) {
  const Icon = warning.level === "warn" ? AlertTriangle : Info;
  return (
    <div
      role="status"
      className="mt-6 rounded-xl border border-border bg-surface/60 p-4 text-sm text-foreground"
    >
      <p className="flex items-center gap-2 font-semibold">
        <Icon className="size-4 text-accent" aria-hidden />
        {warning.title}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
        {warning.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p className="mt-3">
        <a
          href="/settings?tab=billing"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          View plans and pricing
        </a>
      </p>
    </div>
  );
}
