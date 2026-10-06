import { type NextRequest, NextResponse } from "next/server";

import { refreshAccess } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/errors";
import { visitorIpFrom } from "@/lib/client-ip";
import {
  ACCESS_COOKIE,
  ACCESS_REFRESH_LEEWAY_SECONDS,
  clearSessionCookies,
  REFRESH_COOKIE,
  secondsUntilExpiry,
  writeAccessCookie,
} from "@/lib/session-cookies";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/verify", "/admin/session-expired"];

function isPublic(pathname: string): boolean {
  return PUBLIC_ADMIN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function redirectToLogin(request: NextRequest, reason?: "expired"): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  if (reason) url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

/*
  Keeps the admin session fresh. It is a convenience layer, not the authorization boundary:
  every admin page re-checks the session against the API through lib/session.ts.
*/
export async function proxy(request: NextRequest) {
  if (isPublic(request.nextUrl.pathname)) return NextResponse.next();

  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refresh) return redirectToLogin(request);

  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  if (access && secondsUntilExpiry(access) > ACCESS_REFRESH_LEEWAY_SECONDS) {
    return NextResponse.next();
  }

  try {
    const { access: fresh } = await refreshAccess(refresh, visitorIpFrom(request.headers));
    // Rewrite the incoming cookie header so Server Components in this same request see the
    // new token, then persist it in the browser through Set-Cookie.
    request.cookies.set(ACCESS_COOKIE, fresh);
    const response = NextResponse.next({ request: { headers: request.headers } });
    writeAccessCookie(response.cookies, fresh);
    return response;
  } catch (error) {
    if (isApiError(error) && error.isAuthFailure) {
      const response = redirectToLogin(request, "expired");
      clearSessionCookies(response.cookies);
      return response;
    }
    // API unreachable: let the page render its own error state instead of bouncing to login.
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
