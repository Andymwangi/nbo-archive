/*
  Cookie contract for the admin session, shared by proxy.ts, Server Actions and Route Handlers.
  Tokens never reach client JavaScript: both cookies are httpOnly.
*/

export const ACCESS_COOKIE = "nbo_access";
export const REFRESH_COOKIE = "nbo_refresh";

/** Refresh the access token when it has less than this many seconds left. */
export const ACCESS_REFRESH_LEEWAY_SECONDS = 30;

type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
};

type CookieWriter = {
  set(name: string, value: string, options: CookieOptions): unknown;
  delete(name: string): unknown;
};

/** Read the `exp` claim (seconds since epoch) without verifying the signature. The API verifies. */
export function tokenExpiry(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

export function secondsUntilExpiry(token: string, now = Date.now()): number {
  const exp = tokenExpiry(token);
  return exp === null ? 0 : Math.floor(exp - now / 1000);
}

function options(token: string): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(secondsUntilExpiry(token), 0),
  };
}

export function writeAccessCookie(store: CookieWriter, access: string): void {
  store.set(ACCESS_COOKIE, access, options(access));
}

export function writeSessionCookies(
  store: CookieWriter,
  tokens: { access: string; refresh: string },
) {
  store.set(ACCESS_COOKIE, tokens.access, options(tokens.access));
  store.set(REFRESH_COOKIE, tokens.refresh, options(tokens.refresh));
}

export function clearSessionCookies(store: CookieWriter): void {
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}
