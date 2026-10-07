import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";

import { isApiError } from "@/lib/api/errors";
import { type Hold, listMyHolds } from "@/lib/api/holds";

/*
  A storefront visitor is a random key in an httpOnly cookie, created the first time they place a
  hold. It identifies holds and nothing else: no account, no tracking, never readable by page
  scripts. The API stores only its hash.
*/

export const VISITOR_COOKIE = "nbo_visitor";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function readVisitorToken(): Promise<string | undefined> {
  return (await cookies()).get(VISITOR_COOKIE)?.value;
}

/** The visitor's key, minted on first use. Only callable from Server Actions or Route Handlers. */
export async function ensureVisitorToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(VISITOR_COOKIE)?.value;
  if (existing) return existing;
  const token = randomBytes(32).toString("base64url");
  store.set(VISITOR_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  return token;
}

/** Holds are on only when the deployment says so; they stay off until checkout exists. */
export function holdsEnabled(): boolean {
  return process.env.HOLDS_ENABLED === "true";
}

/**
 * The visitor's active holds for this request, fetched once and shared by the layout and the page.
 * A storefront page must still render when the holds service is closed or unreachable, so those
 * cases read as "no holds" rather than an error page.
 */
export const currentHolds = cache(async (): Promise<Hold[]> => {
  if (!holdsEnabled()) return [];
  const token = await readVisitorToken();
  if (!token) return [];
  try {
    return await listMyHolds(token);
  } catch (error) {
    if (isApiError(error)) return [];
    throw error;
  }
});
