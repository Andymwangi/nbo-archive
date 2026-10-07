import { z } from "zod";

import {
  type Category,
  categories,
  chestBands,
  conditions,
  flawSchema,
  imageKinds,
  imageSchema,
} from "@/lib/api/catalog";
import { apiRequest } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { paginatedSchema } from "@/lib/api/types";

/*
  The admin desk's view of the catalogue: every status, every field, and the writes. All calls
  carry the signed-in admin's access token, so none of them are cached.
*/

export const pieceStatuses = [
  "draft",
  "scheduled",
  "live",
  "held",
  "claimed",
  "withdrawn",
] as const;
export type PieceStatus = (typeof pieceStatuses)[number];

/** A sale is in progress or done; the API refuses every catalogue write until it is released. */
export const lockedStatuses: readonly PieceStatus[] = ["held", "claimed"];

export const dropStatuses = ["draft", "scheduled", "released"] as const;
export type DropStatus = (typeof dropStatuses)[number];

export const ADMIN_PAGE_SIZE = 24;
export const MAX_PHOTOS = 12;
/** Matches the API: larger files are refused before they cross the network twice. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const empty = z.object({}).passthrough();

export const adminPieceRowSchema = z.object({
  id: z.number().int(),
  archive_no: z.string(),
  title: z.string(),
  category: z.enum(categories),
  brand: z.string(),
  condition_grade: z.union([z.enum(conditions), z.literal("")]),
  price_kes: z.number().int().nullable(),
  status: z.enum(pieceStatuses),
  drop_number: z.number().int().nullable(),
  release_at: z.string().nullable(),
  published_at: z.string().nullable(),
  is_placeholder: z.boolean(),
  image_count: z.number().int(),
  cover: imageSchema.nullable(),
  updated_at: z.string(),
});
export type AdminPieceRow = z.infer<typeof adminPieceRowSchema>;

export const adminPieceSchema = z.object({
  id: z.number().int(),
  archive_no: z.string(),
  title: z.string(),
  category: z.enum(categories),
  brand: z.string(),
  tagged_size: z.string(),
  fit_note: z.string(),
  colour: z.string(),
  fabric_composition: z.string(),
  era: z.string(),
  condition_grade: z.union([z.enum(conditions), z.literal("")]),
  measurements: z.record(z.string(), z.number()),
  chest_band: z.union([z.enum(chestBands), z.literal("")]),
  category_extras: z.record(z.string(), z.string()),
  cleaned_at: z.string().nullable(),
  provenance_note: z.string(),
  price_kes: z.number().int().nullable(),
  status: z.enum(pieceStatuses),
  drop: z
    .object({ number: z.number().int(), title: z.string(), release_at: z.string().nullable() })
    .nullable(),
  drop_id: z.number().int().nullable(),
  release_at: z.string().nullable(),
  published_at: z.string().nullable(),
  tags: z.array(z.string()),
  claimed_at: z.string().nullable(),
  claimed_city: z.string(),
  is_placeholder: z.boolean(),
  images: z.array(imageSchema),
  flaws: z.array(flawSchema),
  created_by: z.string().nullable(),
  problems: z.record(z.string(), z.array(z.string())),
  active_hold: z.object({ expires_at: z.string(), created_at: z.string() }).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type AdminPiece = z.infer<typeof adminPieceSchema>;

export const adminDropSchema = z.object({
  id: z.number().int(),
  number: z.number().int(),
  title: z.string(),
  intro: z.string(),
  release_at: z.string().nullable(),
  status: z.enum(dropStatuses),
  piece_count: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type AdminDrop = z.infer<typeof adminDropSchema>;

const piecePageSchema = paginatedSchema(adminPieceRowSchema);
export type AdminPiecePage = z.infer<typeof piecePageSchema>;
const dropPageSchema = paginatedSchema(adminDropSchema);
export type AdminDropPage = z.infer<typeof dropPageSchema>;

// Pieces

export type PieceListFilters = {
  page?: number;
  status?: readonly PieceStatus[];
  category?: readonly Category[];
  q?: string;
};

export function listAdminPieces(access: string, filters: PieceListFilters = {}) {
  return apiRequest("/admin/accessions/", {
    token: access,
    schema: piecePageSchema,
    query: {
      page: filters.page,
      page_size: ADMIN_PAGE_SIZE,
      status: filters.status,
      category: filters.category,
      q: filters.q,
    },
  });
}

/** A piece by its row id, or null when there is none. */
export async function getAdminPiece(access: string, id: number): Promise<AdminPiece | null> {
  try {
    return await apiRequest(`/admin/accessions/${id}/`, {
      token: access,
      schema: adminPieceSchema,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export type PieceChanges = Partial<{
  title: string;
  category: Category;
  brand: string;
  tagged_size: string;
  fit_note: string;
  colour: string;
  fabric_composition: string;
  era: string;
  condition_grade: (typeof conditions)[number] | "";
  measurements: Record<string, number>;
  category_extras: Record<string, string>;
  cleaned_at: string | null;
  provenance_note: string;
  price_kes: number | null;
  drop_id: number | null;
  tags: string[];
}>;

export function createPiece(access: string, data: { category: Category }) {
  return apiRequest("/admin/accessions/", {
    method: "POST",
    token: access,
    body: data,
    schema: adminPieceSchema,
  });
}

export function updatePiece(access: string, id: number, changes: PieceChanges) {
  return apiRequest(`/admin/accessions/${id}/`, {
    method: "PATCH",
    token: access,
    body: changes,
    schema: adminPieceSchema,
  });
}

export function deletePiece(access: string, id: number) {
  return apiRequest(`/admin/accessions/${id}/`, { method: "DELETE", token: access, schema: empty });
}

export function publishPiece(access: string, id: number) {
  return apiRequest(`/admin/accessions/${id}/publish/`, {
    method: "POST",
    token: access,
    schema: adminPieceSchema,
  });
}

/** Pieces in a drop take the drop's time; `releaseAt` is only read for pieces outside one. */
export function schedulePiece(access: string, id: number, releaseAt?: string) {
  return apiRequest(`/admin/accessions/${id}/schedule/`, {
    method: "POST",
    token: access,
    body: releaseAt ? { release_at: releaseAt } : {},
    schema: adminPieceSchema,
  });
}

export function withdrawPiece(access: string, id: number) {
  return apiRequest(`/admin/accessions/${id}/withdraw/`, {
    method: "POST",
    token: access,
    schema: adminPieceSchema,
  });
}

/** Clear a stuck hold and put the piece back on sale. */
export function releasePieceHold(access: string, id: number) {
  return apiRequest(`/admin/accessions/${id}/release-hold/`, {
    method: "POST",
    token: access,
    schema: adminPieceSchema,
  });
}

// Photos

export const imageKindSchema = z.enum(imageKinds);
export type ImageKind = z.infer<typeof imageKindSchema>;

/** `form` carries `file`, `kind` and optionally `alt_text`. */
export function uploadPhoto(access: string, pieceId: number, form: FormData) {
  return apiRequest(`/admin/accessions/${pieceId}/images/`, {
    method: "POST",
    token: access,
    body: form,
    schema: imageSchema,
  });
}

export function updatePhoto(
  access: string,
  pieceId: number,
  imageId: number,
  changes: Partial<{ kind: ImageKind; alt_text: string }>,
) {
  return apiRequest(`/admin/accessions/${pieceId}/images/${imageId}/`, {
    method: "PATCH",
    token: access,
    body: changes,
    schema: imageSchema,
  });
}

export function deletePhoto(access: string, pieceId: number, imageId: number) {
  return apiRequest(`/admin/accessions/${pieceId}/images/${imageId}/`, {
    method: "DELETE",
    token: access,
    schema: empty,
  });
}

export function reorderPhotos(access: string, pieceId: number, ids: number[]) {
  return apiRequest(`/admin/accessions/${pieceId}/images/order/`, {
    method: "POST",
    token: access,
    body: { ids },
    schema: z.array(imageSchema),
  });
}

// Flaws

export type FlawInput = { description: string; image_id: number | null };

export function addFlaw(access: string, pieceId: number, data: FlawInput) {
  return apiRequest(`/admin/accessions/${pieceId}/flaws/`, {
    method: "POST",
    token: access,
    body: data,
    schema: flawSchema,
  });
}

export function updateFlaw(
  access: string,
  pieceId: number,
  flawId: number,
  changes: Partial<FlawInput>,
) {
  return apiRequest(`/admin/accessions/${pieceId}/flaws/${flawId}/`, {
    method: "PATCH",
    token: access,
    body: changes,
    schema: flawSchema,
  });
}

export function deleteFlaw(access: string, pieceId: number, flawId: number) {
  return apiRequest(`/admin/accessions/${pieceId}/flaws/${flawId}/`, {
    method: "DELETE",
    token: access,
    schema: empty,
  });
}

// Drops

export function listAdminDrops(access: string, page = 1, pageSize = ADMIN_PAGE_SIZE) {
  return apiRequest("/admin/drops/", {
    token: access,
    query: { page, page_size: pageSize },
    schema: dropPageSchema,
  });
}

export async function getAdminDrop(access: string, id: number): Promise<AdminDrop | null> {
  try {
    return await apiRequest(`/admin/drops/${id}/`, { token: access, schema: adminDropSchema });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function createDrop(access: string, data: { title: string; intro?: string }) {
  return apiRequest("/admin/drops/", {
    method: "POST",
    token: access,
    body: data,
    schema: adminDropSchema,
  });
}

export function updateDrop(
  access: string,
  id: number,
  changes: Partial<{ title: string; intro: string }>,
) {
  return apiRequest(`/admin/drops/${id}/`, {
    method: "PATCH",
    token: access,
    body: changes,
    schema: adminDropSchema,
  });
}

export function deleteDrop(access: string, id: number) {
  return apiRequest(`/admin/drops/${id}/`, { method: "DELETE", token: access, schema: empty });
}

export function scheduleDrop(access: string, id: number, releaseAt: string) {
  return apiRequest(`/admin/drops/${id}/schedule/`, {
    method: "POST",
    token: access,
    body: { release_at: releaseAt },
    schema: adminDropSchema,
  });
}

export function releaseDrop(access: string, id: number) {
  return apiRequest(`/admin/drops/${id}/release/`, {
    method: "POST",
    token: access,
    schema: adminDropSchema,
  });
}
