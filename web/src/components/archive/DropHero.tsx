import Link from "next/link";

import { DropCountdown } from "@/components/archive/DropCountdown";
import { Button } from "@/components/primitives/Button";
import { copy } from "@/content/copy";
import type { Drop } from "@/lib/api/drops";
import { formatDateTime } from "@/lib/format";

/*
  While an accession is scheduled, the front page opens on its catalogue sheet: the number, the
  title, the departures-board clock and one way to hear the moment it opens. Its pieces stay
  hidden until then, exactly as the archive keeps them.
*/
export function DropHero({ drop }: { drop: Drop & { release_at: string } }) {
  const number = String(drop.number).padStart(2, "0");
  return (
    <section
      aria-labelledby="drop-hero"
      className="grid gap-8 border-[1.5px] border-ink bg-paper-2 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12 lg:p-12"
    >
      <div className="flex flex-col gap-4">
        <p className="meta text-ink-muted">
          {copy.home.dropEyebrow} / {copy.drops.number(drop.number)}
        </p>
        <p aria-hidden className="font-display text-numeral leading-[0.8] text-signal">
          {number}
        </p>
        <h1 id="drop-hero" className="max-w-[20ch] font-display text-display">
          <Link href={`/drops/${drop.number}`} className="no-underline hover:underline">
            {drop.title}
          </Link>
        </h1>
        {drop.intro ? <p className="max-w-[52ch] text-lead text-ink-muted">{drop.intro}</p> : null}
        <p className="meta text-ink-muted">
          {copy.drops.opensAt(formatDateTime(drop.release_at))} /{" "}
          {copy.drops.pieces(drop.piece_count)}
        </p>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Button asChild variant="signal" icon="arrow-right">
            <Link href="#drop-list" className="no-underline">
              {copy.home.joinList}
            </Link>
          </Button>
          <Link href={`/drops/${drop.number}`} className="inline-flex min-h-11 items-center meta">
            {copy.drops.number(drop.number)}
          </Link>
        </div>
      </div>
      <DropCountdown
        releaseAt={drop.release_at}
        fallback={copy.drops.opensAt(formatDateTime(drop.release_at))}
        size="hero"
      />
    </section>
  );
}
