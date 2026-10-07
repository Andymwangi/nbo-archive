import { z } from "zod";

import { apiRequest } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { paginatedSchema } from "@/lib/api/types";

/*
  Public catalogue reads. Responses sit in Next's data cache for a minute and are tagged so the
  admin desk can refresh them the moment a piece changes (see `catalogTags`).
*/

export const CATALOG_REVALIDATE_SECONDS = 60;

export const catalogTags = {
  all: "catalog",
  piece: (archiveNo: string) => `piece:${archiveNo}`,
} as const;

export const categories = ["polo", "jacket", "sweater", "hoodie", "tee"] as const;
export const chestBands = ["xs", "s", "m", "l", "xl", "xxl"] as const;
export const conditions = ["mint", "excellent", "good", "worn_in"] as const;
export const sorts = ["newest", "price", "-price", "number", "-number"] as const;
export const imageKinds = ["front", "back", "tag", "care", "texture", "flaw", "on_body"] as const;

export type Category = (typeof categories)[number];
export type ChestBand = (typeof chestBands)[number];
export type Condition = (typeof conditions)[number];
export type Sort = (typeof sorts)[number];

export const publicStatusSchema = z.enum(["live", "held", "claimed"]);
export type PublicStatus = z.infer<typeof publicStatusSchema>;

export const imageSchema = z.object({
  id: z.number().int(),
  kind: z.enum(imageKinds),
  url: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  placeholder: z.string(),
  alt_text: z.string(),
  position: z.number().int(),
});
export type ArchiveImage = z.infer<typeof imageSchema>;

export const pieceCardSchema = z.object({
  archive_no: z.string(),
  title: z.string(),
  category: z.enum(categories),
  brand: z.string(),
  tagged_size: z.string(),
  chest_band: z.union([z.enum(chestBands), z.literal("")]),
  colour: z.string(),
  era: z.string(),
  condition_grade: z.union([z.enum(conditions), z.literal("")]),
  price_kes: z.number().int().nullable(),
  status: publicStatusSchema,
  drop_number: z.number().int().nullable(),
  published_at: z.string().nullable(),
  is_placeholder: z.boolean(),
  cover: imageSchema.nullable(),
});
export type PieceCard = z.infer<typeof pieceCardSchema>;

export const flawSchema = z.object({
  id: z.number().int(),
  description: z.string(),
  image_id: z.number().int().nullable(),
  position: z.number().int(),
});
export type Flaw = z.infer<typeof flawSchema>;

export const pieceSchema = pieceCardSchema.omit({ cover: true, drop_number: true }).extend({
  fit_note: z.string(),
  fabric_composition: z.string(),
  measurements: z.record(z.string(), z.number()),
  category_extras: z.record(z.string(), z.string()),
  cleaned_at: z.string().nullable(),
  provenance_note: z.string(),
  drop: z
    .object({ number: z.number().int(), title: z.string(), release_at: z.string().nullable() })
    .nullable(),
  images: z.array(imageSchema),
  flaws: z.array(flawSchema),
  claimed: z.object({ city: z.string(), claimed_at: z.string().nullable() }).nullable(),
  related: z.array(pieceCardSchema),
});
export type Piece = z.infer<typeof pieceSchema>;

const facetSchema = z.array(z.object({ value: z.string(), count: z.number().int() }));

export const facetsSchema = z.object({
  category: facetSchema,
  chest_band: facetSchema,
  condition: facetSchema,
  brand: facetSchema,
  colour: facetSchema,
  era: facetSchema,
  drop: facetSchema,
  price_min: z.number().int().nullable(),
  price_max: z.number().int().nullable(),
});
export type Facets = z.infer<typeof facetsSchema>;
export type Facet = z.infer<typeof facetSchema>[number];

export const piecePageSchema = paginatedSchema(pieceCardSchema);
export type PiecePage = z.infer<typeof piecePageSchema>;

/** Archive filters exactly as the URL carries them; the archive page and the API share names. */
export type ArchiveFilters = {
  category: Category[];
  size: ChestBand[];
  condition: Condition[];
  brand: string[];
  colour: string[];
  era: string[];
  drop?: number;
  priceMin?: number;
  priceMax?: number;
  includeClaimed: boolean;
  sort: Sort;
  page: number;
};

export const ARCHIVE_PAGE_SIZE = 24;

type SearchParams = Record<string, string | string[] | undefined>;

function all(params: SearchParams, key: string): string[] {
  const raw = params[key];
  const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  // Text filters accept a comma list too, matching the API.
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function oneOf<T extends string>(allowed: readonly T[], values: string[]): T[] {
  return [...new Set(values.filter((value): value is T => allowed.includes(value as T)))];
}

function wholeNumber(value: string | undefined, min = 0): number | undefined {
  if (value === undefined || !/^\d{1,9}$/.test(value)) return undefined;
  const number = Number(value);
  return number >= min ? number : undefined;
}

/**
 * Read filters from the archive URL. Anything unknown or malformed is dropped rather than sent,
 * so a mangled link shows the archive instead of an error.
 */
export function parseArchiveFilters(params: SearchParams): ArchiveFilters {
  const first = (key: string) => all(params, key)[0];
  const sort = first("sort");
  return {
    category: oneOf(categories, all(params, "category")),
    size: oneOf(chestBands, all(params, "size")),
    condition: oneOf(conditions, all(params, "condition")),
    brand: [...new Set(all(params, "brand"))],
    colour: [...new Set(all(params, "colour"))],
    era: [...new Set(all(params, "era"))],
    drop: wholeNumber(first("drop"), 1),
    priceMin: wholeNumber(first("price_min")),
    priceMax: wholeNumber(first("price_max")),
    includeClaimed: first("include_claimed") === "true",
    sort: sorts.includes(sort as Sort) ? (sort as Sort) : "newest",
    page: wholeNumber(first("page"), 1) ?? 1,
  };
}

/** The URL query for a set of filters. Defaults are left out so links stay short. */
export function archiveQuery(
  filters: ArchiveFilters,
): Record<string, string | number | string[] | undefined> {
  return {
    category: filters.category,
    size: filters.size,
    condition: filters.condition,
    brand: filters.brand.length ? filters.brand.join(",") : undefined,
    colour: filters.colour.length ? filters.colour.join(",") : undefined,
    era: filters.era.length ? filters.era.join(",") : undefined,
    drop: filters.drop,
    price_min: filters.priceMin,
    price_max: filters.priceMax,
    include_claimed: filters.includeClaimed ? "true" : undefined,
    sort: filters.sort === "newest" ? undefined : filters.sort,
    page: filters.page > 1 ? filters.page : undefined,
  };
}

/** `/archive?...` for a set of filters. */
export function archiveHref(filters: ArchiveFilters): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(archiveQuery(filters))) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== "") search.append(key, String(item));
    }
  }
  const query = search.toString();
  return query ? `/archive?${query}` : "/archive";
}

export function countActiveFilters(filters: ArchiveFilters): number {
  return (
    filters.category.length +
    filters.size.length +
    filters.condition.length +
    filters.brand.length +
    filters.colour.length +
    filters.era.length +
    (filters.drop !== undefined ? 1 : 0) +
    (filters.priceMin !== undefined ? 1 : 0) +
    (filters.priceMax !== undefined ? 1 : 0) +
    (filters.includeClaimed ? 1 : 0)
  );
}

const cache = { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [catalogTags.all] };

export function listPieces(
  filters: ArchiveFilters,
  pageSize: number = ARCHIVE_PAGE_SIZE,
): Promise<PiecePage> {
  return apiRequest("/catalog/accessions/", {
    schema: piecePageSchema,
    query: { ...archiveQuery(filters), page_size: pageSize },
    ...cache,
  });
}

/** A piece by any archive-number spelling, or null when there is no public piece under it. */
export async function getPiece(archiveNo: string): Promise<Piece | null> {
  try {
    return await apiRequest(`/catalog/accessions/${encodeURIComponent(archiveNo)}/`, {
      schema: pieceSchema,
      revalidate: CATALOG_REVALIDATE_SECONDS,
      tags: [catalogTags.all, catalogTags.piece(archiveNo.toUpperCase())],
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function getFacets(): Promise<Facets> {
  return apiRequest("/catalog/facets/", { schema: facetsSchema, ...cache });
}
