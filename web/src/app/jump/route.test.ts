import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "@/app/jump/route";

function jump(query: string) {
  const response = GET(new NextRequest(`http://internal:3000/jump${query}`));
  return { status: response.status, location: response.headers.get("Location") };
}

describe("GET /jump", () => {
  it.each([
    ["?no=142", "/item/NBO-0142"],
    ["?no=NBO-0007", "/item/NBO-0007"],
    ["?no=nbo0042", "/item/NBO-0042"],
  ])("sends %s to the record", (query, location) => {
    expect(jump(query)).toEqual({ status: 303, location });
  });

  it.each(["?no=hello", "?no=", ""])("sends %j to the archive", (query) => {
    expect(jump(query)).toEqual({ status: 303, location: "/archive" });
  });

  it("redirects relative to the visitor's host, not the server's", () => {
    expect(jump("?no=1").location?.startsWith("/")).toBe(true);
  });
});
