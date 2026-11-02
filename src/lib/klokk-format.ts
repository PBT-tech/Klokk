// Pure formatting helpers — safe to import anywhere (client + server).

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", opts ?? { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateShort(iso: string): string {
  return formatDate(iso, { month: "short", day: "numeric" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

export function relativeDeadline(iso: string): string {
  const now = Date.now();
  const target = new Date(iso).getTime();
  const diff = target - now;
  const absDays = Math.round(Math.abs(diff) / 86_400_000);
  if (diff < 0) return absDays <= 0 ? "expired" : `${absDays}d overdue`;
  if (absDays <= 0) return "today";
  if (absDays === 1) return "tomorrow";
  return `in ${absDays}d`;
}

export function daysUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function toISODate(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function toSlotLabel(date: string, start: string, end: string): string {
  const d = new Date(`${date}T${start ?? "00:00"}:00`);
  const day = d.toLocaleDateString("en-US", { weekday: "short" });
  const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${day} ${monthDay} · ${format12(start ?? "00:00")}–${format12(end ?? "00:00")}`;
}

export function format12(hhmm: string): string {
  const parts = hhmm.split(":");
  const hStr = parts[0] ?? "0";
  const m = parts[1] ?? "00";
  let h = parseInt(hStr, 10) || 0;
  const mer = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${mer}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 2) return phone;
  return `•••••${digits.slice(-2)}`;
}

export function initials(first: string, last = ""): string {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

export function statusLabel(status: string): string {
  switch (status) {
    case "awaiting_responses":
      return "Awaiting responses";
    case "ready_to_confirm":
      return "Ready to confirm";
    case "confirmed":
      return "Confirmed";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

/** Label for the confirmed meeting time (a proposed slot or a custom time), or "" if none. */
export function confirmedTimeLabel(event: {
  slots: { id: string; date: string; startTime: string; endTime: string }[];
  confirmedSlotId?: string | undefined;
  confirmedCustom?: { date: string; startTime: string; endTime: string } | undefined;
}): string {
  if (event.confirmedCustom) {
    const c = event.confirmedCustom;
    return toSlotLabel(c.date, c.startTime, c.endTime);
  }
  const slot = event.slots.find((s) => s.id === event.confirmedSlotId);
  return slot ? toSlotLabel(slot.date, slot.startTime, slot.endTime) : "";
}
