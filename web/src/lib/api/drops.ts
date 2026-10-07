import { z } from "zod";

import { CATALOG_REVALIDATE_SECONDS, catalogTags } from "@/lib/api/catalog";
import { apiRequest } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { paginatedSchema } from "@/lib/api/types";

/*
  Drops are published as numbered Accessions. A scheduled drop is public before its release so
  it can be teased; its pieces only become visible at the release time.
*/

export const dropTags = {
  all: "drops",
  drop: (number: number) => `drop:${number}`,
} as const;

export const dropSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  intro: z.string(),
  release_at: z.string().nullable(),
  released: z.boolean(),
  piece_count: z.number().int(),
});
export type Drop = z.infer<typeof dropSchema>;

export const dropPageSchema = paginatedSchema(dropSchema);

const cache = {
  revalidate: CATALOG_REVALIDATE_SECONDS,
  tags: [dropTags.all, catalogTags.all],
};

export function listDrops(page = 1): Promise<z.infer<typeof dropPageSchema>> {
  return apiRequest("/catalog/drops/", {
    schema: dropPageSchema,
    query: { page: page > 1 ? page : undefined },
    ...cache,
  });
}

export async function getDrop(number: number): Promise<Drop | null> {
  try {
    return await apiRequest(`/catalog/drops/${number}/`, {
      schema: dropSchema,
      revalidate: CATALOG_REVALIDATE_SECONDS,
      tags: [...cache.tags, dropTags.drop(number)],
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * The scheduled drop releasing soonest, if any. Only the first page (the 24 highest numbers) is
 * read; an upcoming drop is almost always among the newest, and older ones are long released.
 */
export async function nextDrop(now: Date = new Date()): Promise<Drop | null> {
  const { results } = await listDrops();
  const upcoming = results
    .filter((drop) => !drop.released && drop.release_at && new Date(drop.release_at) > now)
    .sort((a, b) => Date.parse(a.release_at!) - Date.parse(b.release_at!));
  return upcoming[0] ?? null;
}

export const pulseSchema = z.object({
  next_drop: dropSchema.nullable(),
  on_rail: z.number().int(),
  on_hold: z.number().int(),
});
export type Pulse = z.infer<typeof pulseSchema>;

/** The live strip: the next drop and how busy the rail is. Cached for a minute like the rest. */
export function getPulse(): Promise<Pulse> {
  return apiRequest("/catalog/pulse/", { schema: pulseSchema, ...cache });
}
