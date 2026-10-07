"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { copy } from "@/content/copy";
import { useCountdown } from "@/hooks/useCountdown";
import { pad2 } from "@/lib/format";

/*
  The hold clock: a ticket stub torn from the rail, minutes and seconds in mono figures. It counts
  down to the expiry the API set, never to a time the browser invented, so the clock and the
  server agree. Before hydration it shows the minutes left as text. At zero the page re-renders
  from the server, which shows the piece back on the rail.

  Two things keep it honest on real phones. The gap between the phone's clock and the server's
  is measured once at hydration and applied, so a phone running fast does not end a live hold
  early. And because the clock counts whole seconds, zero can arrive a moment before the server
  agrees; the page is refreshed after a short grace period and again until the hold is gone.

  Screen readers hear the time left at five minutes and at one minute, not every second.
*/
type HoldTimerProps = {
  expiresAt: string;
  /** The server's clock when it rendered the page. */
  serverNow: string;
  /** Minutes left when the server rendered, shown until the clock hydrates. */
  fallbackMinutes: number;
  size?: "large" | "small";
};

const ANNOUNCE_AT_MINUTES = [5, 1];
const REFRESH_EVERY_MS = 2000;
const MAX_REFRESHES = 5;

export function HoldTimer({
  expiresAt,
  serverNow,
  fallbackMinutes,
  size = "large",
}: HoldTimerProps) {
  // Positive when the phone's clock is ahead of the server's. It also absorbs the page's network
  // time, which only ever moves the end later, never earlier.
  const [skewMs] = useState(() =>
    typeof window === "undefined" ? 0 : Date.now() - Date.parse(serverNow),
  );
  const left = useCountdown(new Date(Date.parse(expiresAt) + (Number.isNaN(skewMs) ? 0 : skewMs)));
  const router = useRouter();
  const done = left?.done ?? false;

  useEffect(() => {
    if (!done) return;
    let refreshes = 0;
    const timer = setInterval(() => {
      router.refresh();
      refreshes += 1;
      if (refreshes >= MAX_REFRESHES) clearInterval(timer);
    }, REFRESH_EVERY_MS);
    return () => clearInterval(timer);
  }, [done, router]);

  if (left === null) {
    return (
      <p className="font-meta text-lead tabular-nums">{pad2(Math.max(fallbackMinutes, 0))}:00</p>
    );
  }
  if (left.done) {
    return <p className="font-meta text-lead text-signal">{copy.hold.expiredNote}</p>;
  }

  // A hold is 15 minutes, but the clock must stay honest if the duration is ever configured longer.
  const minutes = left.days * 1440 + left.hours * 60 + left.minutes;
  const announce =
    left.seconds === 0 && ANNOUNCE_AT_MINUTES.includes(minutes)
      ? `${minutes} ${minutes === 1 ? "minute" : "minutes"} left on your hold`
      : "";
  const figure = size === "large" ? "text-display" : "text-lead";

  return (
    <div className="flex flex-col gap-1">
      <p
        role="timer"
        aria-label={copy.hold.timerLabel}
        className={`font-meta leading-none tabular-nums ${figure} ${minutes < 2 ? "text-signal" : ""}`}
      >
        {pad2(minutes)}:{pad2(left.seconds)}
      </p>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
