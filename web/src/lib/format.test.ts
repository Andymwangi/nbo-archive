import { describe, expect, it } from "vitest";

import { countdown, formatDate, formatKes, pad2 } from "@/lib/format";

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
