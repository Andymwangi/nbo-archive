import Link from "next/link";
import { connection } from "next/server";

import { ArrivalRail } from "@/components/archive/ArrivalRail";
import { type CategoryPlate, CategoryPlates } from "@/components/archive/CategoryPlates";
import { DropHero } from "@/components/archive/DropHero";
import { Icon } from "@/components/primitives/Icon";
import { copy } from "@/content/copy";
import { categories, getFacets, listPieces, parseArchiveFilters } from "@/lib/api/catalog";
import { getPulse } from "@/lib/api/drops";

/*
  Signature moment: the front page is the rail itself. The newest piece's number is set huge and
  cropped by the edge of the page, as if stencilled on a crate half out of frame, with the newest
  pieces on a rail beneath it. When an accession is scheduled, its countdown sheet takes the top
  of the page and the rail follows. No banner, no slogan.
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

  // Each plate shows its category's newest piece. The rail already holds the newest pieces, so
  // only categories missing from it cost an extra (cached) request.
  const counts = new Map(facets.category.map((row) => [row.value, row.count]));
  const stocked = categories.filter((category) => (counts.get(category) ?? 0) > 0);
  const fromRail = new Map(
    stocked.map((category) => [
      category,
      recent.results.find((piece) => piece.category === category && piece.cover)?.cover ?? null,
    ]),
  );
  const missing = stocked.filter((category) => !fromRail.get(category));
  const fetched = await Promise.all(
    missing.map((category) => listPieces({ ...parseArchiveFilters({}), category: [category] }, 1)),
  );
  missing.forEach((category, index) => {
    fromRail.set(category, fetched[index]?.results[0]?.cover ?? null);
  });
  const plates: CategoryPlate[] = stocked.map((category) => ({
    category,
    count: counts.get(category) ?? 0,
    cover: fromRail.get(category) ?? null,
  }));

  const RailHeading = drop ? "h2" : "h1";

  return (
    <div className="flex flex-col gap-16 md:gap-24">
      {drop ? <DropHero drop={drop} /> : null}

      {latest ? (
        <section aria-labelledby="rail-title" className="flex flex-col gap-6">
          {!drop && latest ? (
            <Link
              href={`/item/${latest.archive_no}`}
              className="-mb-4 block overflow-hidden no-underline"
              aria-label={`${copy.home.eyebrow}: ${latest.archive_no} ${latest.title}`}
            >
              <span className="flex items-baseline gap-3 meta text-ink-muted">
                {copy.home.eyebrow} / {latest.archive_no}
              </span>
              <span
                aria-hidden
                className="-ml-[0.04em] block h-[0.66em] font-display text-[clamp(6rem,24vw,22rem)] leading-[0.82] tracking-[-0.06em]"
              >
                {latest.archive_no.replace(/^NBO-/, "")}
              </span>
            </Link>
          ) : null}
          <div className="flex flex-wrap items-end justify-between gap-4 border-t-[1.5px] border-ink pt-4">
            <div className="flex flex-col gap-1">
              <RailHeading id="rail-title" className="font-display text-title">
                {copy.home.railTitle}
              </RailHeading>
              <p className="meta text-ink-muted">{copy.home.railLede(pulse.on_rail)}</p>
            </div>
            <Link href="/archive" className="inline-flex min-h-11 items-center gap-2 meta">
              {copy.home.browse}
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
