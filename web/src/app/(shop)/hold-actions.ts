"use server";

import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import type { HoldActionState } from "@/app/(shop)/hold-state";
import { copy } from "@/content/copy";
import { catalogTags } from "@/lib/api/catalog";
import { isApiError } from "@/lib/api/errors";
import { MAX_ACTIVE_HOLDS, placeHold, releaseHold } from "@/lib/api/holds";
import { canonicalArchiveNo } from "@/lib/archive-no";
import { visitorIpFrom } from "@/lib/client-ip";
import { ensureVisitorToken, holdsEnabled, readVisitorToken } from "@/lib/visitor";

function refreshPiece(archiveNo: string) {
  // The grid and the record both read the cached catalogue; expire it so the change shows now.
  updateTag(catalogTags.all);
  updateTag(catalogTags.piece(archiveNo));
}

function failure(error: unknown): HoldActionState {
  if (!isApiError(error)) throw error;
  const messages: Record<string, string> = {
    piece_held: copy.hold.errors.pieceHeld,
    not_for_sale: copy.hold.errors.notForSale,
    hold_limit: copy.hold.errors.limit(MAX_ACTIVE_HOLDS),
    holds_closed: copy.hold.errors.closed,
    not_found: copy.hold.errors.gone,
    throttled: copy.errors.throttled,
    network_error: copy.errors.network,
  };
  const message = messages[error.code];
  return { status: "error", message: message ?? copy.errors.unexpected };
}

export async function placeHoldAction(
  _: HoldActionState,
  formData: FormData,
): Promise<HoldActionState> {
  if (!holdsEnabled()) return { status: "error", message: copy.hold.errors.closed };
  const archiveNo = canonicalArchiveNo(String(formData.get("archive_no") ?? ""));
  if (!archiveNo) return { status: "error", message: copy.hold.errors.gone };

  try {
    const token = await ensureVisitorToken();
    await placeHold(token, archiveNo, visitorIpFrom(await headers()));
  } catch (error) {
    // Someone else's hold or a sale changes what the record should show either way.
    if (isApiError(error) && error.status === 409) refreshPiece(archiveNo);
    return failure(error);
  }
  refreshPiece(archiveNo);
  return { status: "ok" };
}

const releaseSchema = z.object({
  hold_id: z.coerce.number().int().positive(),
  archive_no: z.string(),
});

export async function releaseHoldAction(
  _: HoldActionState,
  formData: FormData,
): Promise<HoldActionState> {
  if (!holdsEnabled()) return { status: "error", message: copy.hold.errors.closed };
  const parsed = releaseSchema.safeParse(Object.fromEntries(formData));
  const archiveNo = parsed.success ? canonicalArchiveNo(parsed.data.archive_no) : null;
  const token = await readVisitorToken();
  if (!parsed.success || !archiveNo || !token) {
    return { status: "error", message: copy.errors.unexpected };
  }

  try {
    await releaseHold(token, parsed.data.hold_id, visitorIpFrom(await headers()));
  } catch (error) {
    return failure(error);
  }
  refreshPiece(archiveNo);
  return { status: "ok", message: copy.hold.released };
}
