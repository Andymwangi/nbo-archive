import { describe, expect, it } from "vitest";

import { canonicalArchiveNo, formatArchiveNo, splitArchiveNo } from "@/lib/archive-no";

describe("canonicalArchiveNo", () => {
  it.each([
    ["NBO-0142", "NBO-0142"],
    ["nbo-0142", "NBO-0142"],
    ["NBO0142", "NBO-0142"],
    ["0142", "NBO-0142"],
    ["142", "NBO-0142"],
    [" 7 ", "NBO-0007"],
    ["NBO-12345", "NBO-12345"],
  ])("reads %s as %s", (raw, expected) => {
    expect(canonicalArchiveNo(raw)).toBe(expected);
  });

  it.each(["0", "NBO-", "abc", "142a", "-1", "", "1234567890"])("rejects %j", (raw) => {
    expect(canonicalArchiveNo(raw)).toBeNull();
  });
});

describe("formatArchiveNo and splitArchiveNo", () => {
  it("pads to four digits and grows past them", () => {
    expect(formatArchiveNo(7)).toBe("NBO-0007");
    expect(formatArchiveNo(12345)).toBe("NBO-12345");
  });

  it("splits the prefix from the digits", () => {
    expect(splitArchiveNo("NBO-0142")).toEqual({ prefix: "NBO-", digits: "0142" });
    expect(splitArchiveNo("0142")).toEqual({ prefix: "", digits: "0142" });
  });
});
