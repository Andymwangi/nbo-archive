import type { NextRequest } from "next/server";

import { canonicalArchiveNo } from "@/lib/archive-no";

/*
  Target of the archive-number jump form. A number in any spelling goes to its record (which
  shows the not-in-the-index page if no public piece has it); anything else goes to the archive.
*/
export function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("no") ?? "";
  const archiveNo = canonicalArchiveNo(raw);
  const target = archiveNo ? `/item/${archiveNo}` : "/archive";
  // A relative Location keeps the redirect on whatever host the visitor used, even behind a proxy.
  return new Response(null, { status: 303, headers: { Location: target } });
}
