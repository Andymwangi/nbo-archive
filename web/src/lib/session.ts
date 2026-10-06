import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getMe } from "@/lib/api/auth";
import { ApiError, isApiError } from "@/lib/api/errors";
import type { AdminRole, AdminUser } from "@/lib/api/types";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/session-cookies";

export const SESSION_EXPIRED_PATH = "/admin/session-expired";

export async function readSessionTokens(): Promise<{ access?: string; refresh?: string }> {
  const store = await cookies();
  return { access: store.get(ACCESS_COOKIE)?.value, refresh: store.get(REFRESH_COOKIE)?.value };
}

/** The signed-in admin for this request, fetched once and shared by layout and page. */
export const currentAdmin = cache(async (): Promise<{ user: AdminUser; access: string }> => {
  const { access, refresh } = await readSessionTokens();
  if (!access) {
    // A refresh cookie without an access cookie means proxy.ts could not reach the API to
    // renew it. That is an outage, not a revoked session: show the error page and keep the
    // refresh cookie so the next attempt can recover.
    if (refresh) throw new ApiError(0, "network_error", "The archive API is unreachable.");
    redirect(SESSION_EXPIRED_PATH);
  }
  try {
    return { user: await getMe(access), access };
  } catch (error) {
    if (isApiError(error) && error.isAuthFailure) redirect(SESSION_EXPIRED_PATH);
    throw error;
  }
});

/** Like currentAdmin, but sends admins without one of `roles` back to the desk. */
export async function requireRole(roles: readonly AdminRole[]) {
  const session = await currentAdmin();
  if (!roles.includes(session.user.role)) redirect("/admin?denied=1");
  return session;
}
