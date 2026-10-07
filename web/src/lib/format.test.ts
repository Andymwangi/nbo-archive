import { describe, expect, it } from "vitest";

import {
  countdown,
  formatDate,
  formatKes,
  fromNairobiInput,
  pad2,
  toNairobiInput,
} from "@/lib/format";

describe("formatKes", () => {
  it("groups thousands and keeps whole shillings", () => {
    expect(formatKes(2800)).toBe("KES 2,800");
    expect(formatKes(125000)).toBe("KES 125,000");
    expect(formatKes(0)).toBe("KES 0");
  });
});

describe("formatDate", () => {
  it("formats in Nairobi time across the UTC day boundary", () => {
    // 22:30 UTC on 30 Sep is 01:30 on 1 Oct in Nairobi.
    expect(formatDate("2026-09-30T22:30:00Z")).toBe("1 Oct 2026");
    expect(formatDate("2026-10-01")).toBe("1 Oct 2026");
  });

  it("returns unparseable input unchanged", () => {
    expect(formatDate("soon")).toBe("soon");
  });
});

describe("countdown", () => {
  const now = new Date("2026-10-07T12:00:00Z");

  it("splits the time left into days, hours, minutes and seconds", () => {
    const target = new Date("2026-10-09T15:04:05Z");
    expect(countdown(target, now)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
  });

  it("never goes negative once the time has passed", () => {
    expect(countdown(new Date("2026-10-07T11:00:00Z"), now)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  });

  it("pads clock digits", () => {
    expect(pad2(4)).toBe("04");
    expect(pad2(12)).toBe("12");
  });
});

describe("Nairobi datetime inputs", () => {
  it("round-trips through the input format", () => {
    expect(fromNairobiInput("2026-10-08T18:00")).toBe("2026-10-08T18:00:00+03:00");
    expect(toNairobiInput("2026-10-08T15:00:00Z")).toBe("2026-10-08T18:00");
    expect(toNairobiInput(fromNairobiInput("2026-12-31T23:30"))).toBe("2026-12-31T23:30");
  });

  it("crosses midnight and month ends in Nairobi, not UTC", () => {
    expect(toNairobiInput("2026-10-31T22:30:00Z")).toBe("2026-11-01T01:30");
  });

  it.each(["", "2026-02-31T10:00", "2026-10-08 18:00", "2026-13-01T00:00", "2026-10-08T24:00"])(
    "rejects %j",
    (raw) => {
      expect(fromNairobiInput(raw)).toBeNull();
    },
  );

  it("leaves empty and malformed timestamps blank", () => {
    expect(toNairobiInput(null)).toBe("");
    expect(toNairobiInput("not a date")).toBe("");
  });
});
