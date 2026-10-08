import Link from "next/link";

import { DropCountdown } from "@/components/archive/DropCountdown";
import { Button } from "@/components/primitives/Button";
import { copy } from "@/content/copy";
import type { Drop } from "@/lib/api/drops";
import { formatDateTime } from "@/lib/format";

/*
  While an accession is scheduled it gets a band under the hero: its number and title, the
  departures-board clock, and one way to hear the moment it opens. Its pieces stay hidden until
  then, exactly as the archive keeps them.
*/
export function DropBand({ drop }: { drop: Drop & { release_at: string } }) {
  return (
    <section
      aria-labelledby="next-drop"
      className="grid gap-6 border-[1.5px] border-ink bg-paper-2 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10"
    >
      <div className="flex flex-col gap-3">
        <p className="meta text-ink-muted">
          {copy.home.dropEyebrow} / {copy.drops.number(drop.number)}
        </p>
        <h2 id="next-drop" className="font-display text-title">
          <Link href={`/drops/${drop.number}`} className="no-underline hover:underline">
            {drop.title}
          </Link>
        </h2>
        <p className="meta text-ink-muted">
          {copy.drops.opensAt(formatDateTime(drop.release_at))} /{" "}
          {copy.drops.pieces(drop.piece_count)}
        </p>
        <div>
          <Button asChild variant="signal" icon="arrow-right">
            <Link href="#drop-list" className="no-underline">
              {copy.home.joinList}
            </Link>
          </Button>
        </div>
      </div>
      <DropCountdown
        releaseAt={drop.release_at}
        fallback={copy.drops.opensAt(formatDateTime(drop.release_at))}
        size="large"
      />
    </section>
  );
}
