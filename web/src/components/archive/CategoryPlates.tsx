import Image from "next/image";
import Link from "next/link";

import { copy } from "@/content/copy";
import type { Category, PieceCard } from "@/lib/api/catalog";

export type CategoryPlate = { category: Category; count: number; cover: PieceCard["cover"] };

/*
  One plate per category that has pieces on the rail, photographed with the newest piece in it
  and labelled with a live count, like the tabs on a set of specimen drawers.
*/
export function CategoryPlates({ plates }: { plates: CategoryPlate[] }) {
  if (plates.length === 0) return null;
  return (
    <section aria-labelledby="categories" className="flex flex-col gap-6">
      <h2 id="categories" className="border-b-[1.5px] border-ink pb-3 font-display text-title">
        {copy.home.categoriesTitle}
      </h2>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-5">
        {plates.map((plate) => (
          <li key={plate.category}>
            <Link
              href={`/archive?category=${plate.category}`}
              className="group block border-[1.5px] border-ink no-underline"
            >
              <span className="relative block aspect-[4/5] overflow-hidden bg-paper-3">
                {plate.cover ? (
                  <Image
                    src={plate.cover.url}
                    alt=""
                    fill
                    sizes="(min-width: 64rem) 18vw, (min-width: 40rem) 30vw, 46vw"
                    placeholder={plate.cover.placeholder ? "blur" : "empty"}
                    blurDataURL={plate.cover.placeholder || undefined}
                    className="object-cover"
                  />
                ) : null}
              </span>
              <span className="flex items-baseline justify-between gap-2 border-t-[1.5px] border-ink bg-paper px-3 py-2.5">
                <span className="font-display text-lead group-hover:underline">
                  {copy.labels.categoryPlural[plate.category]}
                </span>
                <span className="meta text-ink-muted tabular-nums">
                  {copy.home.categoryCount(plate.count)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
