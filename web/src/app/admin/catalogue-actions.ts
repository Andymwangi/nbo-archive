"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { failure, stringValues } from "@/app/admin/action-utils";
import type { FormState } from "@/app/admin/form-state";
import { copy } from "@/content/copy";
import {
  addFlaw,
  createDrop,
  createPiece,
  deleteDrop,
  deleteFlaw,
  deletePhoto,
  deletePiece,
  imageKindSchema,
  type PieceChanges,
  publishPiece,
  releaseDrop,
  releasePieceHold,
  reorderPhotos,
  scheduleDrop,
  schedulePiece,
  updateDrop,
  updateFlaw,
  updatePhoto,
  updatePiece,
  withdrawPiece,
} from "@/lib/api/admin";
import { catalogTags, categories, conditions } from "@/lib/api/catalog";
import { dropTags } from "@/lib/api/drops";
import { isApiError } from "@/lib/api/errors";
import { formatDateTime, fromNairobiInput } from "@/lib/format";
import { extrasFromForm, measurementsFromForm } from "@/lib/piece-spec";
import { requireRole } from "@/lib/session";

/*
  Catalogue writes from the desk. Every action re-checks the role (the page hiding a button is
  not a permission), calls the API, then expires the storefront's cached reads with updateTag so
  the next visitor, and the person who made the change, see it at once. Every storefront read
  carries the `catalog` tag (drop reads too), so expiring it covers piece, archive, home and
  drop pages alike.
*/

const WRITERS = ["owner", "editor"] as const;

const idSchema = z.coerce.number().int().positive();

function refreshPiece(id: number) {
  updateTag(catalogTags.all);
  revalidatePath("/admin/accessions");
  revalidatePath(`/admin/accessions/${id}`);
}

function refreshDrops() {
  updateTag(catalogTags.all);
  updateTag(dropTags.all);
  revalidatePath("/admin/drops");
}

function readId(formData: FormData, name = "id"): number | null {
  const parsed = idSchema.safeParse(formData.get(name));
  return parsed.success ? parsed.data : null;
}

const pieceGone = { notFound: copy.accessionsDesk.gone };
const dropGone = { notFound: copy.dropsDesk.gone };

// Pieces

export async function createPieceAction(_: FormState, formData: FormData): Promise<FormState> {
  const { access } = await requireRole(WRITERS);
  const category = z.enum(categories).safeParse(formData.get("category"));
  if (!category.success) {
    return { status: "error", fields: { category: copy.accessionsDesk.categoryRequired } };
  }
  let id: number;
  try {
    id = (await createPiece(access, { category: category.data })).id;
  } catch (error) {
    return failure(error, { fieldNames: ["category"] });
  }
  revalidatePath("/admin/accessions");
  redirect(`/admin/accessions/${id}`);
}

const DETAIL_FIELDS = [
  "title",
  "category",
  "brand",
  "tagged_size",
  "fit_note",
  "colour",
  "fabric_composition",
  "era",
  "condition_grade",
  "cleaned_at",
  "price_kes",
  "provenance_note",
] as const;

const text = (max: number) => z.string().trim().max(max, copy.pieceDesk.fields.tooLong);

const detailsSchema = z.object({
  title: text(120),
  category: z.enum(categories),
  brand: text(80),
  tagged_size: text(24),
  fit_note: text(120),
  colour: text(40),
  fabric_composition: text(160),
  era: text(40),
  condition_grade: z.union([z.enum(conditions), z.literal("")]),
  cleaned_at: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value))),
      copy.pieceDesk.fields.dateInvalid,
    )
    .transform((value) => value || null),
  price_kes: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 10_000_000),
      copy.pieceDesk.fields.priceInvalid,
    )
    .transform((value) => (value ? Number(value) : null)),
  provenance_note: text(600),
});

export async function savePieceDetailsAction(_: FormState, formData: FormData): Promise<FormState> {
  const { access } = await requireRole(WRITERS);
  const id = readId(formData);
  const values = stringValues(formData, DETAIL_FIELDS);
  if (id === null) return { status: "error", message: copy.errors.unexpected };

  const parsed = detailsSchema.safeParse(values);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return { status: "error", values, fields };
  }
  try {
    await updatePiece(access, id, parsed.data);
  } catch (error) {
    return failure(error, { fieldNames: DETAIL_FIELDS, values, ...pieceGone });
  }
  refreshPiece(id);
  return { status: "ok", message: copy.pieceDesk.saved };
}

export async function saveMeasurementsAction(_: FormState, formData: FormData): Promise<FormState> {
  const { access } = await requireRole(WRITERS);
  const id = readId(formData);
  if (id === null) return { status: "error", message: copy.errors.unexpected };
  const values = Object.fromEntries(
    [...formData.entries()].filter(([, value]) => typeof value === "string"),
  ) as Record<string, string>;

  const { value, errors } = measurementsFromForm(formData);
  if (Object.keys(errors).length) return { status: "error", values, fields: errors };
  try {
    await updatePiece(access, id, { measurements: value });
  } catch (error) {
    const state = failure(error, { values, ...pieceGone });
    if (isApiError(error) && error.fields.measurements) {
      return { ...state, message: error.fieldMessage("measurements") };
    }
    return state;
  }
  refreshPiece(id);
  return { status: "ok", message: copy.pieceDesk.saved };
}

export async function saveExtrasAction(_: FormState, formData: FormData): Promise<FormState> {
  const { access } = await requireRole(WRITERS);
  const id = readId(formData);
  const category = z.enum(categories).safeParse(formData.get("category"));
  if (id === null || !category.success) return { status: "error", message: copy.errors.unexpected };
  const values = Object.fromEntries(
    [...formData.entries()].filter(([, value]) => typeof value === "string"),
  ) as Record<string, string>;

  const { value, errors } = extrasFromForm(category.data, formData);
  if (Object.keys(errors).length) return { status: "error", values, fields: errors };
  // The category is sent along so a change made in another tab cannot pair these extras with
  // the wrong garment; the API validates extras against it.
  const changes: PieceChanges = { category: category.data, category_extras: value };
  try {
    await updatePiece(access, id, changes);
  } catch (error) {
    const state = failure(error, { values, ...pieceGone });
    if (isApiError(error) && error.fields.category_extras) {
      return { ...state, message: error.fieldMessage("category_extras") };
    }
    return state;
  }
  refreshPiece(id);
  return { status: "ok", message: copy.pieceDesk.saved };
}

export async function saveDropAction(_: FormState, formData: FormData): Promise<FormState> {
  const { access } = await requireRole(WRITERS);
  const id = readId(formData);
  if (id === null) return { status: "error", message: copy.errors.unexpected };
  const raw = formData.get("drop_id");
  const dropId = raw === "" || raw === null ? null : readId(formData, "drop_id");
  if (raw !== "" && raw !== null && dropId === null) {
    return { status: "error", message: copy.errors.unexpected };
  }
  try {
    await updatePiece(access, id, { drop_id: dropId });
  } catch (error) {
    return failure(error, { fieldNames: ["drop_id"], ...pieceGone });
  }
  refreshPiece(id);
  return { status: "ok", message: copy.pieceDesk.saved };
}

const transitionSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("publish"), id: idSchema }),
  z.object({ intent: z.literal("withdraw"), id: idSchema }),
  z.object({ intent: z.literal("delete"), id: idSchema }),
  z.object({ intent: z.literal("release_hold"), id: idSchema }),
  z.object({
    intent: z.literal("schedule"),
    id: idSchema,
    release_at: z.string().optional().default(""),
    in_drop: z.enum(["0", "1"]).optional().default("0"),
  }),
]);

export async function pieceTransitionAction(_: FormState, formData: FormData): Promise<FormState> {
  const { access } = await requireRole(WRITERS);
  const parsed = transitionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: copy.errors.unexpected };
  const input = parsed.data;

  let releaseAt: string | undefined;
  if (input.intent === "schedule" && input.in_drop === "0") {
    releaseAt = fromNairobiInput(input.release_at) ?? undefined;
    if (!releaseAt) {
      return {
        status: "error",
        values: { release_at: input.release_at },
        fields: { release_at: copy.pieceDesk.releaseAtInvalid },
      };
    }
  }

  let message: string;
  try {
    switch (input.intent) {
      case "publish":
        await publishPiece(access, input.id);
        message = copy.pieceDesk.published;
        break;
      case "withdraw":
        await withdrawPiece(access, input.id);
        message = copy.pieceDesk.withdrawn;
        break;
      case "delete":
        await deletePiece(access, input.id);
        message = "";
        break;
      case "release_hold":
        await releasePieceHold(access, input.id);
        message = copy.pieceDesk.holdReleased;
        break;
      case "schedule": {
        const piece = await schedulePiece(access, input.id, releaseAt);
        message = copy.pieceDesk.scheduled(formatDateTime(piece.release_at ?? ""));
        break;
      }
    }
  } catch (error) {
    if (isApiError(error) && error.code === "validation_error") {
      if (input.intent === "schedule" && error.fields.release_at) {
        return {
          status: "error",
          values: { release_at: input.release_at },
          fields: { release_at: error.fieldMessage("release_at") ?? "" },
        };
      }
      // The problems panel on the page already lists what is missing; point at it.
      return { status: "error", message: copy.pieceDesk.notReady };
    }
    return failure(error, pieceGone);
  }

  if (input.intent === "delete") {
    revalidatePath("/admin/accessions");
    redirect("/admin/accessions");
  }
  refreshPiece(input.id);
  return { status: "ok", message };
}

// Photos

const photoSchema = z.object({
  id: idSchema,
  image_id: idSchema,
  kind: imageKindSchema,
  alt_text: z.string().trim().max(160, copy.pieceDesk.fields.tooLong),
});

export async function savePhotoAction(_: FormState, formData: FormData): Promise<FormState> {
  const { access } = await requireRole(WRITERS);
  const values = stringValues(formData, ["kind", "alt_text"]);
  const parsed = photoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return { status: "error", values, fields };
  }
  const { id, image_id, kind, alt_text } = parsed.data;
  try {
    await updatePhoto(access, id, image_id, { kind, alt_text });
  } catch (error) {
    return failure(error, { fieldNames: ["kind", "alt_text"], values, ...pieceGone });
  }
  refreshPiece(id);
  return { status: "ok", message: copy.pieceDesk.saved };
}

const photoOrderSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.enum(["up", "down"]),
    id: idSchema,
    image_id: idSchema,
    order: z.string(),
  }),
  z.object({ intent: z.literal("remove"), id: idSchema, image_id: idSchema }),
]);

/** Move one photo a place earlier or later, or remove it. */
export async function arrangePhotoAction(_: FormState, formData: FormData): Promise<FormState> {
  const { access } = await requireRole(WRITERS);
  const parsed = photoOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: copy.errors.unexpected };
  const input = parsed.data;
  try {
    if (input.intent === "remove") {
      await deletePhoto(access, input.id, input.image_id);
    } else {
      const ids = input.order.split(",").map(Number);
      const from = ids.indexOf(input.image_id);
      const to = input.intent === "up" ? from - 1 : from + 1;
      if (from < 0 || ids.some((n) => !Number.isInteger(n) || n <= 0)) {
        return { status: "error", message: copy.errors.unexpected };
      }
      if (to < 0 || to >= ids.length) return { status: "idle" };
      [ids[from], ids[to]] = [ids[to]!, ids[from]!];
      await reorderPhotos(access, input.id, ids);
    }
  } catch (error) {
    // A stale order (a photo added or removed in another tab) comes back as a validation error.
    if (isApiError(error) && error.code === "validation_error") {
      return { status: "error", message: error.fieldMessage("ids") ?? error.message };
    }
    return failure(error, pieceGone);
  }
  refreshPiece(input.id);
  return { status: "ok" };
}

// Flaws

const flawSchema = z.object({
  id: idSchema,
  description: z
    .string()
    .trim()
    .min(1, copy.flawsDesk.required)
    .max(280, copy.pieceDesk.fields.tooLong),
  image_id: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      const id = Number(value);
      if (!Number.isInteger(id) || id <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: copy.errors.unexpected });
        return z.NEVER;
      }
      return id;
    }),
});

export async function saveFlawAction(_: FormState, formData: FormData): Promise<FormState> {
  const { access } = await requireRole(WRITERS);
  const values = stringValues(formData, ["description", "image_id"]);
  const flawId = formData.get("flaw_id") ? readId(formData, "flaw_id") : undefined;
  const parsed = flawSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || flawId === null) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error?.issues ?? []) {
      fields[String(issue.path[0])] ??= issue.message;
    }
    return { status: "error", values, fields };
  }
  const { id, description, image_id } = parsed.data;
  try {
    if (flawId === undefined) {
      await addFlaw(access, id, { description, image_id });
    } else {
      await updateFlaw(access, id, flawId, { description, image_id });
    }
  } catch (error) {
    // A live piece refuses a flaw without its close-up; the API says why under `flaws`.
    if (isApiError(error) && error.fields.flaws) {
      return { status: "error", values, fields: { image_id: error.fieldMessage("flaws") ?? "" } };
    }
    return failure(error, { fieldNames: ["description", "image_id"], values, ...pieceGone });
  }
  refreshPiece(id);
  return flawId === undefined ? { status: "ok" } : { status: "ok", message: copy.pieceDesk.saved };
}

export async function deleteFlawAction(_: FormState, formData: FormData): Promise<FormState> {
  const { access } = await requireRole(WRITERS);
  const id = readId(formData);
  const flawId = readId(formData, "flaw_id");
  if (id === null || flawId === null) return { status: "error", message: copy.errors.unexpected };
  try {
    await deleteFlaw(access, id, flawId);
  } catch (error) {
    return failure(error, pieceGone);
  }
  refreshPiece(id);
  return { status: "ok" };
}

// Drops

const dropDetailsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, copy.dropsDesk.titleRequired)
    .max(120, copy.pieceDesk.fields.tooLong),
  intro: z.string().trim().max(4000, copy.pieceDesk.fields.tooLong),
});

export async function saveDropDetailsAction(_: FormState, formData: FormData): Promise<FormState> {
  const { access } = await requireRole(WRITERS);
  const values = stringValues(formData, ["title", "intro"]);
  const dropId = formData.get("drop_id") ? readId(formData, "drop_id") : undefined;
  const parsed = dropDetailsSchema.safeParse(values);
  if (!parsed.success || dropId === null) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error?.issues ?? []) {
      fields[String(issue.path[0])] ??= issue.message;
    }
    return { status: "error", values, fields };
  }
  try {
    if (dropId === undefined) {
      await createDrop(access, parsed.data);
    } else {
      await updateDrop(access, dropId, parsed.data);
    }
  } catch (error) {
    return failure(error, { fieldNames: ["title", "intro"], values, ...dropGone });
  }
  refreshDrops();
  return { status: "ok", message: copy.dropsDesk.saved };
}

const dropTransitionSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("schedule"), drop_id: idSchema, release_at: z.string() }),
  z.object({ intent: z.literal("release"), drop_id: idSchema }),
  z.object({ intent: z.literal("delete"), drop_id: idSchema }),
]);

export async function dropTransitionAction(_: FormState, formData: FormData): Promise<FormState> {
  const { access } = await requireRole(WRITERS);
  const parsed = dropTransitionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: copy.errors.unexpected };
  const input = parsed.data;

  let message = "";
  try {
    if (input.intent === "schedule") {
      const releaseAt = fromNairobiInput(input.release_at);
      if (!releaseAt) {
        return {
          status: "error",
          values: { release_at: input.release_at },
          fields: { release_at: copy.pieceDesk.releaseAtInvalid },
        };
      }
      const drop = await scheduleDrop(access, input.drop_id, releaseAt);
      message = copy.dropsDesk.scheduled(formatDateTime(drop.release_at ?? releaseAt));
    } else if (input.intent === "release") {
      await releaseDrop(access, input.drop_id);
      message = copy.dropsDesk.released;
    } else {
      await deleteDrop(access, input.drop_id);
    }
  } catch (error) {
    const values = input.intent === "schedule" ? { release_at: input.release_at } : undefined;
    return failure(error, { fieldNames: ["release_at"], values, ...dropGone });
  }
  refreshDrops();
  return { status: "ok", message };
}
