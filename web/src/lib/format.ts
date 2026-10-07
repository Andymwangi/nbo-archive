const dateTime = new Intl.DateTimeFormat("en-KE", {
  timeZone: "Africa/Nairobi",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "5 Oct 2026, 21:03" in Nairobi time, regardless of where the code runs. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateTime.format(date);
}

const day = new Intl.DateTimeFormat("en-KE", {
  timeZone: "Africa/Nairobi",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "1 Oct 2026" in Nairobi time. Accepts a date ("2026-10-01") or a timestamp. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : day.format(date);
}

const shillings = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 });

/** "KES 2,800". Prices are whole shillings. */
export function formatKes(amount: number): string {
  return `KES ${shillings.format(amount)}`;
}

export type Countdown = { days: number; hours: number; minutes: number; seconds: number };

/** Time left until `target`, never negative. */
export function countdown(target: Date, now: Date): Countdown {
  let rest = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const days = Math.floor(rest / 86_400);
  rest -= days * 86_400;
  const hours = Math.floor(rest / 3_600);
  rest -= hours * 3_600;
  const minutes = Math.floor(rest / 60);
  return { days, hours, minutes, seconds: rest - minutes * 60 };
}

/** Two-digit pad for clock faces. */
export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/*
  The desk always enters times as Nairobi wall-clock time, whatever timezone the staff member's
  browser is in. Nairobi is UTC+3 all year (no daylight saving), so the offset is fixed.
*/
const NAIROBI_OFFSET = "+03:00";
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** ISO timestamp -> `2026-10-08T18:00` for a datetime-local input, in Nairobi time. */
export function toNairobiInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() + NAIROBI_OFFSET_MS).toISOString().slice(0, 16);
}

/** `2026-10-08T18:00` read as Nairobi time -> ISO timestamp, or null when it is not a real time. */
export function fromNairobiInput(value: string): string | null {
  const match = LOCAL_INPUT.exec(value.trim());
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00${NAIROBI_OFFSET}`;
  const date = new Date(iso);
  // Reject rollovers such as 31 February, which Date would quietly move into March.
  if (Number.isNaN(date.getTime()) || toNairobiInput(date.toISOString()) !== value.trim()) {
    return null;
  }
  return iso;
}
