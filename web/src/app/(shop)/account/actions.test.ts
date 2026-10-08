import { beforeEach, describe, expect, it, vi } from "vitest";

import { copy } from "@/content/copy";
import { ApiError } from "@/lib/api/errors";
import { idleState } from "@/lib/form-state";

/*
  The account actions with the API and cookie layers mocked. The same flow was also driven over
  HTTP against a running API and web server.
*/

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "198.51.100.7" })),
  cookies: vi.fn(async () => cookieStore),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
}));
vi.mock("@/lib/api/customers", () => ({
  requestCustomerCode: vi.fn(),
  verifyCustomerCode: vi.fn(),
  updateCustomer: vi.fn(),
  signOutCustomer: vi.fn(),
}));

const api = await import("@/lib/api/customers");
const actions = await import("@/app/(shop)/account/actions");

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.mocked(api.requestCustomerCode).mockReset();
  vi.mocked(api.verifyCustomerCode).mockReset();
  vi.mocked(api.signOutCustomer).mockReset();
  cookieStore.set.mockReset();
  cookieStore.delete.mockReset();
  cookieStore.get.mockReset();
});

describe("requestCodeAction", () => {
  it("asks for a code for the normalised address and moves to the code step", async () => {
    vi.mocked(api.requestCustomerCode).mockResolvedValue({ detail: "sent" });

    const state = await actions.requestCodeAction(idleState, form({ email: " W@Example.com " }));

    expect(state).toEqual({ status: "ok", email: "w@example.com" });
    expect(api.requestCustomerCode).toHaveBeenCalledWith("w@example.com", "198.51.100.7");
  });

  it("refuses something that is not an email without calling the API", async () => {
    const state = await actions.requestCodeAction(idleState, form({ email: "nope" }));
    expect(state.fields?.email).toBe(copy.account.invalidEmail);
    expect(api.requestCustomerCode).not.toHaveBeenCalled();
  });
});

describe("verifyCodeAction", () => {
  it("stores the session in an httpOnly cookie and opens the account", async () => {
    vi.mocked(api.verifyCustomerCode).mockResolvedValue({ token: "t".repeat(43) } as never);

    await expect(
      actions.verifyCodeAction(idleState, form({ email: "w@example.com", code: "123 456" })),
    ).rejects.toMatchObject({ url: "/account" });

    expect(api.verifyCustomerCode).toHaveBeenCalledWith("w@example.com", "123456", "198.51.100.7");
    const [name, value, options] = cookieStore.set.mock.calls[0]!;
    expect(name).toBe("nbo_customer");
    expect(value).toBe("t".repeat(43));
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("keeps the code step open when the code is wrong", async () => {
    vi.mocked(api.verifyCustomerCode).mockRejectedValue(new ApiError(401, "invalid_code", "wrong"));

    const state = await actions.verifyCodeAction(
      idleState,
      form({ email: "w@example.com", code: "000000" }),
    );

    expect(state.status).toBe("ok");
    expect(state.email).toBe("w@example.com");
    expect(state.fields?.code).toBe(copy.account.invalidCode);
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("rejects a code that is not six digits before calling the API", async () => {
    const state = await actions.verifyCodeAction(
      idleState,
      form({ email: "w@example.com", code: "12ab" }),
    );
    expect(state.fields?.code).toBe(copy.account.invalidCode);
    expect(api.verifyCustomerCode).not.toHaveBeenCalled();
  });
});

describe("signOutCustomerAction", () => {
  it("ends the session and clears the cookie even when the API is unreachable", async () => {
    cookieStore.get.mockReturnValue({ value: "session" });
    vi.mocked(api.signOutCustomer).mockRejectedValue(new ApiError(0, "network_error", "down"));

    await expect(actions.signOutCustomerAction()).rejects.toMatchObject({ url: "/" });

    expect(api.signOutCustomer).toHaveBeenCalledWith("session");
    expect(cookieStore.delete).toHaveBeenCalledWith("nbo_customer");
  });
});
