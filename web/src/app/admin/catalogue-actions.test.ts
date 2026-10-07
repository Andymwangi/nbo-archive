import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { idleState } from "@/lib/form-state";

/*
  The drop drawers and the new-piece drawer only exist once JavaScript opens them, so these
  actions are exercised here with the API, session and cache layers mocked. The piece-page
  actions were also driven end to end against a running API and web server.
*/

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
}));
vi.mock("@/lib/session", () => ({
  requireRole: vi.fn(async () => ({ access: "jwt", user: { role: "editor" } })),
}));
vi.mock("@/lib/api/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin")>();
  return {
    ...actual,
    createPiece: vi.fn(),
    createDrop: vi.fn(),
    updateDrop: vi.fn(),
    scheduleDrop: vi.fn(),
    releaseDrop: vi.fn(),
    deleteDrop: vi.fn(),
  };
});

const admin = await import("@/lib/api/admin");
const cache = await import("next/cache");
const session = await import("@/lib/session");
const actions = await import("@/app/admin/catalogue-actions");

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.mocked(cache.updateTag).mockClear();
});

describe("createPieceAction", () => {
  it("takes a number and goes to the new piece", async () => {
    vi.mocked(admin.createPiece).mockResolvedValue({ id: 41 } as never);
    await expect(
      actions.createPieceAction(idleState, form({ category: "hoodie" })),
    ).rejects.toMatchObject({ url: "/admin/accessions/41" });
    expect(admin.createPiece).toHaveBeenCalledWith("jwt", { category: "hoodie" });
    expect(session.requireRole).toHaveBeenCalledWith(["owner", "editor"]);
  });

  it("asks for a category it recognises", async () => {
    const state = await actions.createPieceAction(idleState, form({ category: "sneakers" }));
    expect(state.fields?.category).toBeDefined();
  });
});

describe("saveDropDetailsAction", () => {
  it("opens a new drop when no id is sent", async () => {
    vi.mocked(admin.createDrop).mockResolvedValue({} as never);
    const state = await actions.saveDropDetailsAction(
      idleState,
      form({ title: " Wool and cord ", intro: "" }),
    );
    expect(state.status).toBe("ok");
    expect(admin.createDrop).toHaveBeenCalledWith("jwt", { title: "Wool and cord", intro: "" });
    expect(cache.updateTag).toHaveBeenCalledWith("catalog");
    expect(cache.updateTag).toHaveBeenCalledWith("drops");
  });

  it("edits an existing drop and requires a title", async () => {
    vi.mocked(admin.updateDrop).mockResolvedValue({} as never);
    const blank = await actions.saveDropDetailsAction(
      idleState,
      form({ drop_id: "3", title: "  ", intro: "x" }),
    );
    expect(blank.fields?.title).toBeDefined();
    expect(admin.updateDrop).not.toHaveBeenCalled();

    await actions.saveDropDetailsAction(idleState, form({ drop_id: "3", title: "B", intro: "x" }));
    expect(admin.updateDrop).toHaveBeenCalledWith("jwt", 3, { title: "B", intro: "x" });
  });
});

describe("dropTransitionAction", () => {
  it("reads the release time as Nairobi time", async () => {
    vi.mocked(admin.scheduleDrop).mockResolvedValue({
      release_at: "2026-10-09T15:00:00Z",
    } as never);
    const state = await actions.dropTransitionAction(
      idleState,
      form({ intent: "schedule", drop_id: "3", release_at: "2026-10-09T18:00" }),
    );
    expect(admin.scheduleDrop).toHaveBeenCalledWith("jwt", 3, "2026-10-09T18:00:00+03:00");
    expect(state).toMatchObject({ status: "ok" });
    expect(state.message).toContain("18:00");
  });

  it("refuses an impossible time without calling the API", async () => {
    vi.mocked(admin.scheduleDrop).mockClear();
    const state = await actions.dropTransitionAction(
      idleState,
      form({ intent: "schedule", drop_id: "3", release_at: "2026-02-30T10:00" }),
    );
    expect(state.fields?.release_at).toBeDefined();
    expect(state.values?.release_at).toBe("2026-02-30T10:00");
    expect(admin.scheduleDrop).not.toHaveBeenCalled();
  });

  it("shows the API's reason when a release time is in the past", async () => {
    vi.mocked(admin.scheduleDrop).mockRejectedValue(
      new ApiError(400, "validation_error", "Choose a time in the future, or release now.", {
        release_at: ["Choose a time in the future, or release now."],
      }),
    );
    const state = await actions.dropTransitionAction(
      idleState,
      form({ intent: "schedule", drop_id: "3", release_at: "2020-01-01T10:00" }),
    );
    expect(state.fields?.release_at).toBe("Choose a time in the future, or release now.");
  });

  it("releases and deletes", async () => {
    vi.mocked(admin.releaseDrop).mockResolvedValue({} as never);
    vi.mocked(admin.deleteDrop).mockResolvedValue({} as never);
    expect(
      await actions.dropTransitionAction(idleState, form({ intent: "release", drop_id: "3" })),
    ).toMatchObject({ status: "ok" });
    expect(
      await actions.dropTransitionAction(idleState, form({ intent: "delete", drop_id: "3" })),
    ).toMatchObject({ status: "ok" });
    expect(admin.releaseDrop).toHaveBeenCalledWith("jwt", 3);
    expect(admin.deleteDrop).toHaveBeenCalledWith("jwt", 3);
  });

  it("passes a conflict's message through", async () => {
    vi.mocked(admin.deleteDrop).mockRejectedValue(
      new ApiError(409, "conflict", "Only draft drops can be deleted."),
    );
    const state = await actions.dropTransitionAction(
      idleState,
      form({ intent: "delete", drop_id: "3" }),
    );
    expect(state).toMatchObject({ status: "error", message: "Only draft drops can be deleted." });
  });

  it("ignores tampered input", async () => {
    const state = await actions.dropTransitionAction(
      idleState,
      form({ intent: "explode", drop_id: "3" }),
    );
    expect(state.status).toBe("error");
  });
});
