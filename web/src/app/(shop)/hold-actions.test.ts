import { beforeEach, describe, expect, it, vi } from "vitest";

import { idleHoldState } from "@/app/(shop)/hold-state";
import { copy } from "@/content/copy";
import { ApiError } from "@/lib/api/errors";

/*
  The hold actions with the API, cookie and cache layers mocked. The same flow was also driven
  over HTTP against a running API and web server.
*/

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ updateTag: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "198.51.100.7" })),
}));
vi.mock("@/lib/visitor", () => ({
  holdsEnabled: vi.fn(() => true),
  ensureVisitorToken: vi.fn(async () => "visitor-key"),
  readVisitorToken: vi.fn(async () => "visitor-key"),
}));
vi.mock("@/lib/api/holds", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/holds")>();
  return { ...actual, placeHold: vi.fn(), releaseHold: vi.fn() };
});

const holds = await import("@/lib/api/holds");
const visitor = await import("@/lib/visitor");
const cache = await import("next/cache");
const actions = await import("@/app/(shop)/hold-actions");

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

function conflict(code: string) {
  return new ApiError(409, code, "conflict");
}

beforeEach(() => {
  vi.mocked(cache.updateTag).mockClear();
  vi.mocked(holds.placeHold).mockReset();
  vi.mocked(holds.releaseHold).mockReset();
  vi.mocked(visitor.holdsEnabled).mockReturnValue(true);
  vi.mocked(visitor.readVisitorToken).mockResolvedValue("visitor-key");
});

describe("placeHoldAction", () => {
  it("holds the canonical number for this visitor and refreshes the catalogue", async () => {
    vi.mocked(holds.placeHold).mockResolvedValue({} as never);

    const state = await actions.placeHoldAction(idleHoldState, form({ archive_no: "142" }));

    expect(state).toEqual({ status: "ok" });
    expect(holds.placeHold).toHaveBeenCalledWith("visitor-key", "NBO-0142", "198.51.100.7");
    expect(cache.updateTag).toHaveBeenCalledWith("catalog");
    expect(cache.updateTag).toHaveBeenCalledWith("piece:NBO-0142");
  });

  it.each([
    ["piece_held", copy.hold.errors.pieceHeld],
    ["not_for_sale", copy.hold.errors.notForSale],
    ["hold_limit", copy.hold.errors.limit(3)],
  ])("explains a %s conflict and refreshes the stale record", async (code, message) => {
    vi.mocked(holds.placeHold).mockRejectedValue(conflict(code));

    const state = await actions.placeHoldAction(idleHoldState, form({ archive_no: "NBO-0142" }));

    expect(state).toEqual({ status: "error", message });
    expect(cache.updateTag).toHaveBeenCalledWith("piece:NBO-0142");
  });

  it("reports an unreachable API without touching the cache", async () => {
    vi.mocked(holds.placeHold).mockRejectedValue(new ApiError(0, "network_error", "down"));

    const state = await actions.placeHoldAction(idleHoldState, form({ archive_no: "142" }));

    expect(state).toEqual({ status: "error", message: copy.errors.network });
    expect(cache.updateTag).not.toHaveBeenCalled();
  });

  it("does nothing while holds are switched off", async () => {
    vi.mocked(visitor.holdsEnabled).mockReturnValue(false);

    const state = await actions.placeHoldAction(idleHoldState, form({ archive_no: "142" }));

    expect(state).toEqual({ status: "error", message: copy.hold.errors.closed });
    expect(holds.placeHold).not.toHaveBeenCalled();
  });

  it("rejects a number that is not an archive number", async () => {
    const state = await actions.placeHoldAction(idleHoldState, form({ archive_no: "abc" }));
    expect(state.status).toBe("error");
    expect(holds.placeHold).not.toHaveBeenCalled();
  });
});

describe("releaseHoldAction", () => {
  it("lets go of the visitor's hold and refreshes the catalogue", async () => {
    vi.mocked(holds.releaseHold).mockResolvedValue({} as never);

    const state = await actions.releaseHoldAction(
      idleHoldState,
      form({ hold_id: "12", archive_no: "NBO-0142" }),
    );

    expect(state).toEqual({ status: "ok", message: copy.hold.released });
    expect(holds.releaseHold).toHaveBeenCalledWith("visitor-key", 12, "198.51.100.7");
    expect(cache.updateTag).toHaveBeenCalledWith("piece:NBO-0142");
  });

  it("needs the visitor's own cookie", async () => {
    vi.mocked(visitor.readVisitorToken).mockResolvedValue(undefined);

    const state = await actions.releaseHoldAction(
      idleHoldState,
      form({ hold_id: "12", archive_no: "NBO-0142" }),
    );

    expect(state.status).toBe("error");
    expect(holds.releaseHold).not.toHaveBeenCalled();
  });
});
