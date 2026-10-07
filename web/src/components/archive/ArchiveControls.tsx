import Link from "next/link";

import { Icon } from "@/components/primitives/Icon";
import { copy } from "@/content/copy";
import { type ArchiveFilters, archiveHref, sorts } from "@/lib/api/catalog";
import { formatKes } from "@/lib/format";

/*
  Sort, active filters and paging are plain links: they work without JavaScript, every state
  has its own URL, and the browser's back button restores both the page and the scroll.
*/

export function SortLinks({ filters }: { filters: ArchiveFilters }) {
  return (
    <nav
      aria-label={copy.archive.sortLabel}
      className="flex flex-wrap items-baseline gap-x-4 gap-y-2"
    >
      <span className="meta text-ink-muted">{copy.archive.sortLabel}</span>
      {sorts.map((sort) => {
        const current = filters.sort === sort;
        return (
          <Link
            key={sort}
            href={archiveHref({ ...filters, sort, page: 1 })}
            aria-current={current ? "true" : undefined}
            className={`text-meta ${
              current
                ? "font-medium underline decoration-signal decoration-2 underline-offset-4"
                : "text-ink-muted"
            }`}
          >
            {copy.archive.sort[sort]}
          </Link>
        );
      })}
    </nav>
  );
}

const clearFilters = {
  category: [],
  size: [],
  condition: [],
  brand: [],
  colour: [],
  era: [],
  drop: undefined,
  priceMin: undefined,
  priceMax: undefined,
  includeClaimed: false,
  page: 1,
} satisfies Partial<ArchiveFilters>;

type Chip = { key: string; label: string; href: string };

function chips(filters: ArchiveFilters): Chip[] {
  const base = { ...filters, page: 1 };
  const list: Chip[] = [];
  const without = <K extends "category" | "size" | "condition" | "brand" | "colour" | "era">(
    key: K,
    value: string,
  ) => archiveHref({ ...base, [key]: (filters[key] as string[]).filter((v) => v !== value) });

  for (const value of filters.category)
    list.push({
      key: `c-${value}`,
      label: copy.labels.categoryPlural[value],
      href: without("category", value),
    });
  for (const value of filters.size)
    list.push({
      key: `s-${value}`,
      label: copy.labels.chestBand[value],
      href: without("size", value),
    });
  for (const value of filters.condition)
    list.push({
      key: `q-${value}`,
      label: copy.labels.condition[value],
      href: without("condition", value),
    });
  for (const key of ["era", "brand", "colour"] as const)
    for (const value of filters[key])
      list.push({ key: `${key}-${value}`, label: value, href: without(key, value) });
  if (filters.drop !== undefined)
    list.push({
      key: "drop",
      label: copy.drops.number(filters.drop),
      href: archiveHref({ ...base, drop: undefined }),
    });
  if (filters.priceMin !== undefined)
    list.push({
      key: "min",
      label: `${copy.archive.priceMin} ${formatKes(filters.priceMin)}`,
      href: archiveHref({ ...base, priceMin: undefined }),
    });
  if (filters.priceMax !== undefined)
    list.push({
      key: "max",
      label: `${copy.archive.priceMax} ${formatKes(filters.priceMax)}`,
      href: archiveHref({ ...base, priceMax: undefined }),
    });
  if (filters.includeClaimed)
    list.push({
      key: "claimed",
      label: copy.archive.showClaimed,
      href: archiveHref({ ...base, includeClaimed: false }),
    });
  return list;
}

export function ActiveFilters({ filters }: { filters: ArchiveFilters }) {
  const list = chips(filters);
  if (list.length === 0) return null;
  return (
    <ul className="flex flex-wrap items-center gap-2">
      {list.map((chip) => (
        <li key={chip.key}>
          <Link
            href={chip.href}
            aria-label={copy.archive.remove(chip.label)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-tag border-[1.5px] border-ink bg-paper-2 py-1 pr-2 pl-3 text-meta no-underline hover:bg-paper-3"
          >
            {chip.label}
            <Icon name="close" size={16} />
          </Link>
        </li>
      ))}
      <li>
        <Link href={archiveHref({ ...filters, ...clearFilters })} className="meta">
          {copy.archive.clear}
        </Link>
      </li>
    </ul>
  );
}

export function Pagination({
  filters,
  count,
  pageSize,
}: {
  filters: ArchiveFilters;
  count: number;
  pageSize: number;
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  const page = Math.min(filters.page, pages);
  return (
    <nav
      aria-label={copy.archive.page(page, pages)}
      className="flex items-center justify-between gap-4 border-t-[1.5px] border-ink pt-5"
    >
      {page > 1 ? (
        <Link
          href={archiveHref({ ...filters, page: page - 1 })}
          className="inline-flex min-h-12 items-center gap-2 meta"
          rel="prev"
        >
          <Icon name="chevron-left" size={18} />
          {copy.archive.previous}
        </Link>
      ) : (
        <span />
      )}
      <p className="meta text-ink-muted tabular-nums">{copy.archive.page(page, pages)}</p>
      {page < pages ? (
        <Link
          href={archiveHref({ ...filters, page: page + 1 })}
          className="inline-flex min-h-12 items-center gap-2 meta"
          rel="next"
        >
          {copy.archive.next}
          <Icon name="chevron-right" size={18} />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
