import { type NextRequest, NextResponse } from "next/server";

import { clearSessionCookies } from "@/lib/session-cookies";

/*
  Server Components cannot clear cookies, so a page that finds its session rejected by the API
  redirects here. Clearing first prevents a loop between /admin/login and /admin.
*/
export function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "?reason=expired";
  const response = NextResponse.redirect(url);
  clearSessionCookies(response.cookies);
  return response;
}
