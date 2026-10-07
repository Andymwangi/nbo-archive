"use client";

import Form from "next/form";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/primitives/Button";
import { Drawer } from "@/components/primitives/Drawer";
import { copy } from "@/content/copy";
import {
  type ArchiveFilters,
  type Facet,
  type Facets,
  categories,
  chestBands,
  conditions,
} from "@/lib/api/catalog";

/*
  The card-catalogue drawer. It is a plain GET form on /archive, so the URL is the only state:
  a filtered archive can be bookmarked, shared and reloaded. next/form keeps the navigation
  client-side. Counts come from the facets endpoint and cover pieces still on the rail.
*/

const TEXT_FACET_LIMIT = 16;

type FilterDrawerProps = {
  filters: ArchiveFilters;
  facets: Facets;
  activeCount: number;
};

export function FilterDrawer({ filters, facets, activeCount }: FilterDrawerProps) {
  const [open, setOpen] = useState(false);
  const counts = (facet: Facet[]) => new Map(facet.map((row) => [row.value, row.count]));

  return (
    <>
      <Button icon="filter" iconPosition="start" onClick={() => setOpen(true)}>
        {activeCount ? copy.archive.filtersCount(activeCount) : copy.archive.filters}
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title={copy.archive.filtersTitle}
        description={copy.archive.filtersDescription}
      >
        <Form action="/archive" onSubmit={() => setOpen(false)} className="flex flex-col gap-7">
          {filters.sort !== "newest" ? (
            <input type="hidden" name="sort" value={filters.sort} />
          ) : null}

          <ChoiceGroup
            legend={copy.archive.category}
            name="category"
            options={categories.map((value) => ({
              value,
              label: copy.labels.categoryPlural[value],
            }))}
            selected={filters.category}
            counts={counts(facets.category)}
          />
          <ChoiceGroup
            legend={copy.archive.size}
            name="size"
            options={chestBands.map((value) => ({ value, label: copy.labels.chestBand[value] }))}
            selected={filters.size}
            counts={counts(facets.chest_band)}
            compact
          />
          <ChoiceGroup
            legend={copy.archive.condition}
            name="condition"
            options={conditions.map((value) => ({ value, label: copy.labels.condition[value] }))}
            selected={filters.condition}
            counts={counts(facets.condition)}
          />
          <TextGroup
            legend={copy.archive.era}
            name="era"
            facet={facets.era}
            selected={filters.era}
          />
          <TextGroup
            legend={copy.archive.brand}
            name="brand"
            facet={facets.brand}
            selected={filters.brand}
          />
          <TextGroup
            legend={copy.archive.colour}
            name="colour"
            facet={facets.colour}
            selected={filters.colour}
          />

          {facets.drop.length ? (
            <label className="flex flex-col gap-2">
              <span className="meta text-ink-muted">{copy.archive.drop}</span>
              <select
                name="drop"
                defaultValue={filters.drop ?? ""}
                className="min-h-12 rounded-tag border-[1.5px] border-ink bg-paper px-3"
              >
                <option value="">{copy.archive.anyDrop}</option>
                {facets.drop.map((row) => (
                  <option key={row.value} value={row.value}>
                    {copy.drops.number(Number(row.value))} ({row.count})
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 meta text-ink-muted">{copy.archive.price}</legend>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["price_min", copy.archive.priceMin, filters.priceMin, facets.price_min],
                  ["price_max", copy.archive.priceMax, filters.priceMax, facets.price_max],
                ] as const
              ).map(([name, label, value, hint]) => (
                <label key={name} className="flex flex-col gap-1">
                  <span className="text-meta">{label}</span>
                  <input
                    type="number"
                    name={name}
                    inputMode="numeric"
                    min={0}
                    step={100}
                    defaultValue={value ?? ""}
                    placeholder={hint === null ? undefined : String(hint)}
                    className="min-h-12 rounded-tag border-[1.5px] border-ink bg-paper px-3 font-meta tabular-nums"
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex min-h-12 items-center gap-3">
            <input
              type="checkbox"
              name="include_claimed"
              value="true"
              defaultChecked={filters.includeClaimed}
              className="size-5 accent-[var(--ink)]"
            />
            <span>{copy.archive.showClaimed}</span>
          </label>

          <div className="sticky bottom-0 -mx-5 flex items-center justify-between gap-4 border-t-[1.5px] border-ink bg-paper px-5 py-4 md:-mx-8 md:px-8">
            <Link href="/archive" onClick={() => setOpen(false)} className="meta">
              {copy.archive.clear}
            </Link>
            <Button type="submit">{copy.archive.apply}</Button>
          </div>
        </Form>
      </Drawer>
    </>
  );
}

type Option = { value: string; label: string };

function ChoiceGroup({
  legend,
  name,
  options,
  selected,
  counts,
  compact = false,
}: {
  legend: string;
  name: string;
  options: Option[];
  selected: readonly string[];
  counts: Map<string, number>;
  compact?: boolean;
}) {
  return (
    <fieldset>
      <legend className="mb-3 meta text-ink-muted">{legend}</legend>
      <div className={compact ? "grid grid-cols-3 gap-2" : "flex flex-wrap gap-2"}>
        {options.map((option) => {
          const count = counts.get(option.value) ?? 0;
          return (
            <label key={option.value} className="relative">
              <input
                type="checkbox"
                name={name}
                value={option.value}
                defaultChecked={selected.includes(option.value)}
                className="peer sr-only"
              />
              <span className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-tag border-[1.5px] border-ink px-3 peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink peer-focus-visible:outline-dashed">
                <span>{option.label}</span>
                <span className="font-meta text-micro tabular-nums opacity-70">{count}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function TextGroup({
  legend,
  name,
  facet,
  selected,
}: {
  legend: string;
  name: string;
  facet: Facet[];
  selected: readonly string[];
}) {
  // Keep any selected value visible even when it falls outside the most common ones.
  const shown = [...facet]
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, TEXT_FACET_LIMIT);
  const lower = new Set(shown.map((row) => row.value.toLowerCase()));
  for (const value of selected) {
    if (!lower.has(value.toLowerCase())) shown.push({ value, count: 0 });
  }
  if (shown.length === 0) return null;
  const isSelected = (value: string) =>
    selected.some((choice) => choice.toLowerCase() === value.toLowerCase());
  return (
    <ChoiceGroup
      legend={legend}
      name={name}
      options={shown.map((row) => ({ value: row.value, label: row.value }))}
      selected={shown.filter((row) => isSelected(row.value)).map((row) => row.value)}
      counts={new Map(shown.map((row) => [row.value, row.count]))}
    />
  );
}
