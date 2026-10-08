import Link from "next/link";
import { connection } from "next/server";

import { ArrivalRail } from "@/components/archive/ArrivalRail";
import { type CategoryPlate, CategoryPlates } from "@/components/archive/CategoryPlates";
import { DropBand } from "@/components/archive/DropBand";
import { HeroCarousel } from "@/components/archive/HeroCarousel";
import { PromiseStrip } from "@/components/archive/PromiseStrip";
import { Icon } from "@/components/primitives/Icon";
import { copy } from "@/content/copy";
import { categories, getFacets, listPieces, parseArchiveFilters } from "@/lib/api/catalog";
import { getPulse } from "@/lib/api/drops";

/*
  The front page follows the order shoppers already know: a slideshow hero with one button,
  the shop's promises, what is coming next, the newest pieces as a carousel, then a way in by
  category. The archive's character lives in the details: archive-number stickers on every
  photo, measured sizes, the drop clock.
*/

const RAIL_LENGTH = 12;

export default async function LatestPage() {
  await connection();
  const [recent, pulse, facets] = await Promise.all([
    listPieces(parseArchiveFilters({}), RAIL_LENGTH),
    getPulse(),
    getFacets(),
  ]);
  const latest = recent.results[0];
  const drop = pulse.next_drop?.release_at
    ? { ...pulse.next_drop, release_at: pulse.next_drop.release_at }
    : null;

  if (!latest && !drop) {
    return (
      <section className="flex min-h-[50dvh] flex-col justify-center gap-4">
        <p className="meta text-ink-muted">{copy.home.eyebrow}</p>
        <h1 className="max-w-[18ch] font-display text-display">{copy.home.emptyTitle}</h1>
        <p className="max-w-[44ch] text-lead text-ink-muted">{copy.home.emptyBody}</p>
      </section>
    );
  }

  // Each category tile shows its newest piece. The carousel already holds the newest pieces, so
  // only categories missing from it cost an extra (cached) request.
  const counts = new Map(facets.category.map((row) => [row.value, row.count]));
  const stocked = categories.filter((category) => (counts.get(category) ?? 0) > 0);
  const covers = new Map(
    stocked.map((category) => [
      category,
      recent.results.find((piece) => piece.category === category && piece.cover)?.cover ?? null,
    ]),
  );
  const missing = stocked.filter((category) => !covers.get(category));
  const fetched = await Promise.all(
    missing.map((category) => listPieces({ ...parseArchiveFilters({}), category: [category] }, 1)),
  );
  missing.forEach((category, index) => {
    covers.set(category, fetched[index]?.results[0]?.cover ?? null);
  });
  const plates: CategoryPlate[] = stocked.map((category) => ({
    category,
    count: counts.get(category) ?? 0,
    cover: covers.get(category) ?? null,
  }));

  return (
    <div className="flex flex-col gap-12 md:gap-20">
      <div className="flex flex-col gap-0">
        {recent.results.some((piece) => piece.cover) ? (
          <HeroCarousel pieces={recent.results} />
        ) : (
          <h1 className="sr-only">{copy.home.heroTitle}</h1>
        )}
        <PromiseStrip />
      </div>

      {drop ? <DropBand drop={drop} /> : null}

      {latest ? (
        <section aria-labelledby="new-in" className="flex flex-col gap-6">
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="new-in" className="font-display text-display">
                {copy.home.railTitle}
              </h2>
              <p className="meta text-ink-muted">{copy.home.railLede(pulse.on_rail)}</p>
            </div>
            <Link href="/archive" className="inline-flex min-h-11 items-center gap-2 meta">
              {copy.home.viewAll}
              <Icon name="arrow-right" size={16} />
            </Link>
          </div>
          <ArrivalRail pieces={recent.results} label={copy.home.railTitle} />
        </section>
      ) : null}

      <CategoryPlates plates={plates} />
    </div>
  );
}
