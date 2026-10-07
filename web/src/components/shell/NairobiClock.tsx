"use client";

import { useSyncExternalStore } from "react";

const clock = new Intl.DateTimeFormat("en-KE", {
  timeZone: "Africa/Nairobi",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// The minute changes at most every 60s; checking twice a minute keeps it within 30s of true.
function subscribe(notify: () => void) {
  const timer = setInterval(notify, 30_000);
  return () => clearInterval(timer);
}

function currentMinute(): number {
  return Math.floor(Date.now() / 60_000);
}

/** The time in Nairobi, wherever the visitor is. Server HTML shows the render time. */
export function NairobiClock({ serverNow }: { serverNow: string }) {
  const minute = useSyncExternalStore(subscribe, currentMinute, () =>
    Math.floor(Date.parse(serverNow) / 60_000),
  );
  const now = new Date(minute * 60_000);
  return (
    <time dateTime={now.toISOString()} className="tabular-nums">
      {clock.format(now)}
    </time>
  );
}
