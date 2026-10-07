import { DropCountdown } from "@/components/archive/DropCountdown";
import { copy } from "@/content/copy";
import type { Drop } from "@/lib/api/drops";
import { formatDateTime } from "@/lib/format";

/*
  An accession register entry: the batch number set as a big two-digit numeral in the margin,
  the title and intro beside it, and the state of the drawer (opening clock, or when it opened
  and how much went in) on a ruled line underneath.
*/
export function DropHeader({ drop, headingLevel = 1 }: { drop: Drop; headingLevel?: 1 | 2 }) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const releaseAt = drop.release_at;
  return (
    <header className="grid gap-x-8 gap-y-5 border-b-[1.5px] border-ink pb-6 md:grid-cols-[auto_1fr]">
      <p aria-hidden className="font-display text-numeral text-signal tabular-nums">
        {String(drop.number).padStart(2, "0")}
      </p>
      <div className="flex flex-col gap-4 md:self-end">
        <div className="flex flex-col gap-2">
          <p className="meta text-ink-muted">{copy.drops.number(drop.number)}</p>
          <Heading className="max-w-[20ch] font-display text-display">{drop.title}</Heading>
          {drop.intro ? (
            <p className="max-w-[56ch] text-lead text-ink-muted">{drop.intro}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-ink/25 pt-4">
          {drop.released ? (
            <p className="meta">
              {releaseAt ? copy.drops.released(formatDateTime(releaseAt)) : null}
              {releaseAt ? " / " : null}
              {copy.drops.pieces(drop.piece_count)}
            </p>
          ) : releaseAt ? (
            <>
              <div className="flex flex-col gap-2">
                <p className="meta text-ink-muted">{copy.drops.opensIn}</p>
                <DropCountdown
                  releaseAt={releaseAt}
                  fallback={copy.drops.opensAt(formatDateTime(releaseAt))}
                />
              </div>
              <p className="meta text-ink-muted">
                {copy.drops.opensAt(formatDateTime(releaseAt))} /{" "}
                {copy.drops.pieces(drop.piece_count)}
              </p>
            </>
          ) : (
            <p className="meta text-ink-muted">{copy.drops.unscheduled}</p>
          )}
        </div>
      </div>
    </header>
  );
}
