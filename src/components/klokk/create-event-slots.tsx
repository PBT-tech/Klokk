import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { makeSlot, sortSlots, type Draft } from "@/lib/klokk-create";
import { format12, toSlotLabel } from "@/lib/klokk-format";

export function SlotsStep({
  draft,
  set,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  const [mode, setMode] = useState<"range" | "single">("range");
  const [singleDate, setSingleDate] = useState<Date | undefined>(new Date());
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: new Date(),
    to: new Date(Date.now() + 86_400_000 * 4),
  });
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [skipWeekends, setSkipWeekends] = useState(false);

  const addSingleSlot = () => {
    const slot = makeSlot(singleDate, start, end);
    if (!slot) {
      toast.error("Start time must be before end time");
      return;
    }
    if (draft.slots.some((s) => s.id === slot.id)) {
      toast.error("That slot already exists");
      return;
    }
    set("slots", sortSlots([...draft.slots, slot]));
    toast.success("Time slot added");
  };

  const addRangeSlots = () => {
    if (!dateRange.from) {
      toast.error("Please pick a start date");
      return;
    }
    if (start >= end) {
      toast.error("Start time must be before end time");
      return;
    }
    const from = new Date(dateRange.from);
    const to = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from);
    if (to < from) {
      toast.error("End date must be on or after start date");
      return;
    }

    const newSlots = [...draft.slots];
    let count = 0;
    const cur = new Date(from);
    // Normalize time to avoid DST issues
    cur.setHours(12, 0, 0, 0);
    const normalizedTo = new Date(to);
    normalizedTo.setHours(12, 0, 0, 0);

    while (cur <= normalizedTo) {
      const day = cur.getDay();
      if (!skipWeekends || (day !== 0 && day !== 6)) {
        const slot = makeSlot(cur, start, end);
        if (slot && !newSlots.some((s) => s.id === slot.id)) {
          newSlots.push(slot);
          count++;
        }
      }
      cur.setDate(cur.getDate() + 1);
    }

    if (count === 0) {
      toast.info("All slots for this range and time are already added");
      return;
    }

    set("slots", sortSlots(newSlots));
    toast.success(`Added ${count} slot${count === 1 ? "" : "s"} across selected dates`);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <Label className="text-sm font-semibold text-card-foreground">Select date range</Label>
          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMode("range")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                mode === "range"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-card-foreground"
              }`}
            >
              Start &amp; end range
            </button>
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                mode === "single"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-card-foreground"
              }`}
            >
              Single date
            </button>
          </div>
        </div>

        {mode === "range" ? (
          <div>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Calendar
              mode="range"
              selected={dateRange as any}
              onSelect={(range: any) => setDateRange(range ?? { from: undefined, to: undefined })}
              className="rounded-xl border border-border p-3 bg-card"
            />
            <div className="mt-2.5 flex items-center gap-2">
              <input
                id="skip-weekends"
                type="checkbox"
                checked={skipWeekends}
                onChange={(e) => setSkipWeekends(e.target.checked)}
                className="size-4 rounded border-border text-primary accent-primary"
              />
              <label
                htmlFor="skip-weekends"
                className="cursor-pointer text-xs font-medium text-card-foreground select-none"
              >
                Exclude Saturdays and Sundays
              </label>
            </div>
          </div>
        ) : (
          <Calendar
            mode="single"
            selected={singleDate}
            onSelect={(d) => setSingleDate(d ?? undefined)}
            className="rounded-xl border border-border p-3 bg-card"
          />
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-card-foreground">Start time</Label>
            <Input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="bg-card text-card-foreground border-border"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-card-foreground">End time</Label>
            <Input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="bg-card text-card-foreground border-border"
            />
          </div>
        </div>

        {mode === "range" ? (
          <Button className="mt-4 w-full" onClick={addRangeSlots} variant="default">
            <Plus className="size-4" />
            Add {format12(start)}–{format12(end)} for all dates in range
          </Button>
        ) : (
          <Button className="mt-4 w-full" onClick={addSingleSlot} variant="default">
            <Plus className="size-4" />
            Add{" "}
            {singleDate ? toSlotLabel(singleDate.toISOString().slice(0, 10), start, end) : "slot"}
          </Button>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <Label className="text-sm font-semibold text-card-foreground">
            Candidate time slots ({draft.slots.length})
          </Label>
          {draft.slots.length > 0 && (
            <button
              type="button"
              onClick={() => set("slots", [])}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Clear all
            </button>
          )}
        </div>
        {draft.slots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/40 p-8 text-center text-sm text-muted-foreground">
            Select a start &amp; end date range and a time window, then click add to generate
            candidate slots.
          </div>
        ) : (
          <ul className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
            {draft.slots.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-2.5 shadow-xs"
              >
                <span className="text-sm font-medium text-card-foreground">
                  {toSlotLabel(s.date, s.startTime, s.endTime)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "slots",
                      draft.slots.filter((x) => x.id !== s.id),
                    )
                  }
                  className="p-1 text-muted-foreground transition-colors hover:text-destructive"
                  aria-label="Remove slot"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
