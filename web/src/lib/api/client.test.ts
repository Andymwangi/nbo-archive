import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { apiRequest, buildUrl } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

const ok = z.object({ ok: z.boolean() });

function stubFetch(body: unknown = { ok: true }, status = 200) {
  const fetchMock = vi.fn<
    (url: string, init?: RequestInit & { next?: unknown }) => Promise<Response>
  >(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sent(fetchMock: ReturnType<typeof stubFetch>) {
  const [url, init] = fetchMock.mock.calls[0]!;
  return { url, init: init!, headers: init!.headers as Record<string, string> };
}

beforeEach(() => {
  vi.stubEnv("API_INTERNAL_URL", "http://api:8000");
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8010");
  vi.stubEnv("INTERNAL_API_TOKEN", "s3cret");
});

describe("buildUrl", () => {
  it("repeats array values and drops empty ones", () => {
    const url = new URL(
      buildUrl("/catalog/accessions/", {
        size: ["m", "l"],
        category: [],
        brand: "Lacoste,Fila",
        drop: undefined,
        era: "",
        page: 2,
      }),
    );
    expect(url.origin + url.pathname).toBe("http://api:8000/api/v1/catalog/accessions/");
    expect(url.searchParams.getAll("size")).toEqual(["m", "l"]);
    expect(url.searchParams.get("brand")).toBe("Lacoste,Fila");
    expect(url.searchParams.get("page")).toBe("2");
    expect([...url.searchParams.keys()].sort()).toEqual(["brand", "page", "size", "size"]);
  });
});

describe("apiRequest", () => {
  it("caches public reads with revalidate and tags", async () => {
    const fetchMock = stubFetch();
    await apiRequest("/catalog/facets/", { schema: ok, revalidate: 60, tags: ["catalog"] });
    const { init } = sent(fetchMock);
    expect(init.next).toEqual({ revalidate: 60, tags: ["catalog"] });
    expect(init.cache).toBeUndefined();
  });

  it("never caches without cache options, writes, or authenticated reads", async () => {
    const fetchMock = stubFetch();
    await apiRequest("/a/", { schema: ok });
    await apiRequest("/b/", { schema: ok, method: "POST", body: {}, revalidate: 60 });
    await apiRequest("/c/", { schema: ok, token: "jwt", revalidate: 60 });
    for (const [, init] of fetchMock.mock.calls) {
      expect(init!.cache).toBe("no-store");
      expect(init!.next).toBeUndefined();
    }
  });

  it("sends the internal token on the server's own calls", async () => {
    const fetchMock = stubFetch();
    await apiRequest("/catalog/drops/", { schema: ok });
    expect(sent(fetchMock).headers["X-Internal-Token"]).toBe("s3cret");
  });

  it("forwards the visitor instead of the token on calls made for a visitor", async () => {
    const fetchMock = stubFetch();
    await apiRequest("/auth/magic-link/", {
      schema: ok,
      method: "POST",
      body: {},
      clientIp: "198.51.100.7",
    });
    const { headers } = sent(fetchMock);
    expect(headers["X-Forwarded-For"]).toBe("198.51.100.7");
    expect(headers["X-Internal-Token"]).toBeUndefined();
  });

  it("never sends the token from the browser", async () => {
    vi.stubGlobal("window", {});
    const fetchMock = stubFetch();
    await apiRequest("/catalog/drops/", { schema: ok });
    const { url, headers } = sent(fetchMock);
    expect(url.startsWith("http://localhost:8010/")).toBe(true);
    expect(headers["X-Internal-Token"]).toBeUndefined();
  });

  it("omits the token when it is not configured", async () => {
    vi.stubEnv("INTERNAL_API_TOKEN", "");
    const fetchMock = stubFetch();
    await apiRequest("/catalog/drops/", { schema: ok });
    expect(sent(fetchMock).headers["X-Internal-Token"]).toBeUndefined();
  });

  it("turns the error envelope into an ApiError", async () => {
    stubFetch({ error: { code: "not_found", message: "Not found.", fields: {} } }, 404);
    const error = await apiRequest("/catalog/accessions/NBO-9999/", { schema: ok }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: "not_found" });
  });

  it("rejects a body that does not match the schema", async () => {
    stubFetch({ ok: "yes" });
    await expect(apiRequest("/x/", { schema: ok })).rejects.toMatchObject({
      code: "bad_response",
    });
  });
});

describe("apiRequest bodies", () => {
  it("sends FormData as multipart and lets fetch set the boundary", async () => {
    const fetchMock = stubFetch();
    const form = new FormData();
    form.set("kind", "front");
    await apiRequest("/admin/accessions/1/images/", {
      schema: ok,
      method: "POST",
      token: "jwt",
      body: form,
    });
    const { init, headers } = sent(fetchMock);
    expect(init.body).toBe(form);
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("JSON-encodes plain objects", async () => {
    const fetchMock = stubFetch();
    await apiRequest("/admin/drops/", { schema: ok, method: "POST", token: "jwt", body: { a: 1 } });
    const { init, headers } = sent(fetchMock);
    expect(init.body).toBe('{"a":1}');
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("treats 204 No Content as an empty object", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    await expect(
      apiRequest("/admin/drops/1/", { schema: z.object({}), method: "DELETE", token: "jwt" }),
    ).resolves.toEqual({});
  });
});
