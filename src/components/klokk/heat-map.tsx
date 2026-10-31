import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { toSlotLabel } from "@/lib/klokk-format";
import type { KlokkEvent, TimeSlot } from "@/lib/klokk-types";

export function bestSlot(event: KlokkEvent): TimeSlot | undefined {
  if (event.slots.length === 0) return undefined;
  const counts = event.slots.map((s) => ({
    slot: s,
    count: event.responses.filter((r) => r.slotIds.includes(s.id)).length,
  }));
  counts.sort((a, b) => b.count - a.count);
  return counts[0]?.slot;
}

export function slotCount(event: KlokkEvent, slotId: string): number {
  return event.responses.filter((r) => r.slotIds.includes(slotId)).length;
}

export function AvailabilityHeatMap({
  event,
  selectedSlotId,
  onSelect,
}: {
  event: KlokkEvent;
  selectedSlotId?: string | undefined;
  onSelect?: ((slotId: string) => void) | undefined;
}) {
  const max = useMemo(
    () => Math.max(1, ...event.slots.map((s) => slotCount(event, s.id))),
    [event],
  );
  const total = event.responses.length || 1;
  const best = bestSlot(event);

  if (event.slots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface/40 p-8 text-center text-sm text-muted-foreground">
        No time slots defined for this event.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {event.slots.map((s) => {
        const count = slotCount(event, s.id);
        const pct = count / max;
        const share = count / total;
        const isBest = best?.id === s.id && count > 0;
        const isSelected = selectedSlotId === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect?.(s.id)}
            className={cn(
              "group relative overflow-hidden rounded-xl border p-4 text-left transition-all",
              isSelected
                ? "border-accent/60 shadow-glow"
                : isBest
                  ? "border-primary/40"
                  : "border-border hover:border-primary/30",
            )}
          >
            <div
              aria-hidden
              className="absolute inset-0 bg-primary/5 transition-opacity"
              style={{ opacity: pct * 0.9 }}
            />
            <div className="relative flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {toSlotLabel(s.date, s.startTime, s.endTime)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {count} of {event.responses.length || "—"} available
                </p>
              </div>
              {isBest && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                  Best
                </span>
              )}
            </div>
            <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.round(share * 100)}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
