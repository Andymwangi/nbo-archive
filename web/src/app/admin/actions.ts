"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { failure, stringValues } from "@/app/admin/action-utils";
import type { FormState } from "@/app/admin/form-state";
import { copy } from "@/content/copy";
import {
  createAdmin,
  logout,
  refreshAccess,
  requestMagicLink,
  updateAdmin,
  verifyMagicLink,
} from "@/lib/api/auth";
import { ApiError, isApiError } from "@/lib/api/errors";
import { adminRoleSchema } from "@/lib/api/types";
import { visitorIpFrom } from "@/lib/client-ip";
import { readSessionTokens, requireRole } from "@/lib/session";
import { clearSessionCookies, writeSessionCookies } from "@/lib/session-cookies";

async function visitorIp(): Promise<string | undefined> {
  return visitorIpFrom(await headers());
}

const emailSchema = z.string().trim().toLowerCase().email().max(254);

export async function requestLinkAction(_: FormState, formData: FormData): Promise<FormState> {
  const values = stringValues(formData, ["email"]);
  const parsed = emailSchema.safeParse(values.email);
  if (!parsed.success) {
    return { status: "error", values, fields: { email: copy.login.invalidEmail } };
  }
  try {
    await requestMagicLink(parsed.data, await visitorIp());
  } catch (error) {
    return failure(error, { fieldNames: ["email"], values });
  }
  return { status: "ok", email: parsed.data };
}

export async function verifyLinkAction(_: FormState, formData: FormData): Promise<FormState> {
  const token = formData.get("token");
  if (typeof token !== "string" || token.length < 20) {
    return { status: "error", fields: { token: copy.verify.missingToken } };
  }
  try {
    const pair = await verifyMagicLink(token, await visitorIp());
    writeSessionCookies(await cookies(), pair);
  } catch (error) {
    // 400/401 mean the link itself is spent or bad. Anything else (network, 5xx, throttling)
    // leaves the link unused, so the page keeps the button for a retry.
    if (isApiError(error) && (error.status === 401 || error.status === 400)) {
      return { status: "error", fields: { token: copy.verify.invalid } };
    }
    return failure(error);
  }
  redirect("/admin");
}

export async function signOutAction(): Promise<void> {
  const tokens = await readSessionTokens();
  if (tokens.refresh) {
    try {
      // Logout needs a live access token; mint one if the cookie has already expired so the
      // refresh token is revoked server-side and not merely forgotten by this browser.
      const access = tokens.access ?? (await refreshAccess(tokens.refresh)).access;
      await logout(access, tokens.refresh);
    } catch (error) {
      // An already-invalid refresh token needs no revoking; an unreachable API must not trap
      // the person in a signed-in browser. Either way the cookies go.
      if (!(error instanceof ApiError)) throw error;
    }
  }
  clearSessionCookies(await cookies());
  redirect("/admin/login");
}

const STAFF_FIELDS = ["name", "email", "role", "phone"] as const;

const newStaffSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  role: adminRoleSchema,
  phone: z
    .string()
    .trim()
    .max(24)
    .optional()
    .transform((value) => value || undefined),
});

const staffFieldMessages: Record<(typeof STAFF_FIELDS)[number], string> = {
  name: "Add a name.",
  email: copy.login.invalidEmail,
  role: copy.staff.roleRequired,
  phone: copy.staff.phoneHint,
};

export async function createStaffAction(_: FormState, formData: FormData): Promise<FormState> {
  const { access } = await requireRole(["owner"]);
  const values = stringValues(formData, STAFF_FIELDS);
  const parsed = newStaffSchema.safeParse(values);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]) as (typeof STAFF_FIELDS)[number];
      fields[key] ??= staffFieldMessages[key];
    }
    return { status: "error", values, fields };
  }
  try {
    const created = await createAdmin(access, parsed.data);
    revalidatePath("/admin/staff");
    return { status: "ok", message: copy.staff.created(created.email) };
  } catch (error) {
    return failure(error, { fieldNames: STAFF_FIELDS, values, notFound: copy.staff.gone });
  }
}

const updateStaffSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("role"), id: z.coerce.number().int(), role: adminRoleSchema }),
  z.object({ intent: z.literal("deactivate"), id: z.coerce.number().int() }),
  z.object({ intent: z.literal("reactivate"), id: z.coerce.number().int() }),
]);

export async function updateStaffAction(_: FormState, formData: FormData): Promise<FormState> {
  const { access } = await requireRole(["owner"]);
  const parsed = updateStaffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: copy.errors.unexpected };

  const input = parsed.data;
  const changes =
    input.intent === "role" ? { role: input.role } : { is_active: input.intent === "reactivate" };
  try {
    await updateAdmin(access, input.id, changes);
  } catch (error) {
    return failure(error, { notFound: copy.staff.gone });
  }
  revalidatePath("/admin/staff");
  return { status: "ok", message: input.intent === "role" ? copy.staff.saved : undefined };
}
