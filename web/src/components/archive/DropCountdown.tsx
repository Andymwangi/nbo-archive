"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { copy } from "@/content/copy";
import { useCountdown } from "@/hooks/useCountdown";
import { pad2 } from "@/lib/format";

/*
  A departures-board clock: four mono figures under ruled cells. Before hydration it shows the
  release time as text (the server-rendered fallback), so nothing jumps or reads 00:00:00.
  When it reaches zero the page re-renders from the server to open the drawer.
*/
type DropCountdownProps = {
  releaseAt: string;
  fallback: string;
  size?: "large" | "small";
};

export function DropCountdown({ releaseAt, fallback, size = "large" }: DropCountdownProps) {
  const left = useCountdown(new Date(releaseAt));
  const router = useRouter();
  const done = left?.done ?? false;

  useEffect(() => {
    if (done) router.refresh();
  }, [done, router]);

  if (left === null) {
    return <p className="font-meta text-lead">{fallback}</p>;
  }
  if (left.done) {
    return <p className="font-meta text-lead text-signal">{copy.drops.opening}</p>;
  }

  const units = [
    { value: left.days, label: copy.drops.countdownUnits.days },
    { value: left.hours, label: copy.drops.countdownUnits.hours },
    { value: left.minutes, label: copy.drops.countdownUnits.minutes },
    { value: left.seconds, label: copy.drops.countdownUnits.seconds },
  ];
  const figure = size === "large" ? "text-title" : "text-lead";

  return (
    <div role="timer" aria-label={`${copy.drops.opensIn} ${fallback}`} className="flex gap-2">
      {units.map((unit) => (
        <span key={unit.label} className="flex flex-col items-center gap-1">
          <span
            aria-hidden
            className={`min-w-[2.6ch] border-[1.5px] border-ink bg-paper-2 px-2 py-1 text-center font-meta tabular-nums ${figure}`}
          >
            {pad2(unit.value)}
          </span>
          <span aria-hidden className="meta text-ink-muted">
            {unit.label}
          </span>
        </span>
      ))}
    </div>
  );
}
