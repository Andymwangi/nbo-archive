import Link from "next/link";

import { copy } from "@/content/copy";
import type { Pulse } from "@/lib/api/drops";
import { formatDateTime } from "@/lib/format";

/*
  The live strip above the header: what is coming and how busy the rail is, from real counts.
  It holds still (no marquee); on a phone it keeps the most useful line and drops the rest.
*/
export function PulseStrip({ pulse }: { pulse: Pulse | null }) {
  const drop = pulse?.next_drop;
  return (
    <div className="surface-ink">
      <p
        aria-label={copy.shell.strip.label}
        className="mx-auto flex max-w-[90rem] items-center justify-between gap-6 px-4 py-2 meta md:px-8"
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          <span aria-hidden className="size-1.5 shrink-0 rounded-hole bg-signal" />
          {drop?.release_at ? (
            <Link href={`/drops/${drop.number}`} className="truncate no-underline hover:underline">
              {copy.shell.strip.nextDrop(
                String(drop.number).padStart(2, "0"),
                formatDateTime(drop.release_at),
              )}
              <span className="text-ink-muted"> / {copy.shell.strip.pieces(drop.piece_count)}</span>
            </Link>
          ) : (
            <span className="truncate">{copy.shell.strip.service}</span>
          )}
        </span>
        {pulse ? (
          <span className="hidden shrink-0 items-center gap-4 text-ink-muted sm:flex">
            <span>{copy.shell.strip.onRail(pulse.on_rail)}</span>
            {pulse.on_hold > 0 ? (
              <span className="text-signal">{copy.shell.strip.onHold(pulse.on_hold)}</span>
            ) : null}
            {drop?.release_at ? (
              <span className="hidden lg:inline">{copy.shell.strip.service}</span>
            ) : null}
          </span>
        ) : null}
      </p>
    </div>
  );
}
