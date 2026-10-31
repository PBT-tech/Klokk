import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/klokk-format";
import type { EventStatus } from "@/lib/klokk-types";

const STYLES: Record<EventStatus, string> = {
  awaiting_responses: "bg-surface-muted text-muted-foreground ring-1 ring-border",
  ready_to_confirm: "bg-accent/15 text-accent-foreground ring-1 ring-accent/40",
  confirmed: "bg-primary/10 text-primary ring-1 ring-primary/25",
  expired: "bg-muted text-muted-foreground ring-1 ring-border",
  cancelled: "bg-muted text-muted-foreground ring-1 ring-border line-through",
  closed: "bg-muted text-muted-foreground ring-1 ring-border",
};

export function StatusBadge({ status, className }: { status: EventStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        STYLES[status],
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "ready_to_confirm" && "bg-accent animate-pulse-soft",
          status === "confirmed" && "bg-primary",
          status === "awaiting_responses" && "bg-muted-foreground/50",
          (status === "expired" || status === "cancelled" || status === "closed") &&
            "bg-muted-foreground/40",
        )}
      />
      {statusLabel(status)}
    </span>
  );
}
