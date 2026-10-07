import type { z } from "zod";

import { ApiError, type FieldErrors } from "@/lib/api/errors";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type QueryValue = string | number | undefined;
export type Query = Record<string, QueryValue | readonly QueryValue[]>;

export type RequestOptions<S extends z.ZodTypeAny> = {
  method?: Method;
  body?: unknown;
  token?: string;
  schema: S;
  signal?: AbortSignal;
  /** Arrays become repeated parameters (`?size=m&size=l`). Empty values are dropped. */
  query?: Query;
  /** Visitor address to forward on unauthenticated calls made from the server. */
  clientIp?: string;
  /**
   * Cache the response in Next's data cache for this many seconds. Without `revalidate` or
   * `tags` every call goes to the API.
   */
  revalidate?: number;
  /** Cache tags, so admin writes can refresh affected pages with `revalidateTag`. */
  tags?: string[];
};

const API_PREFIX = "/api/v1";

function baseUrl(): string {
  // Server code talks to the API over the internal network; the browser uses the public URL.
  const url =
    typeof window === "undefined"
      ? (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL)
      : process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    // REQUIRES ENV: API_INTERNAL_URL / NEXT_PUBLIC_API_URL
    throw new Error("API base URL is not configured.");
  }
  return url.replace(/\/$/, "");
}

export function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${baseUrl()}${API_PREFIX}${path}`);
  for (const [key, raw] of Object.entries(query ?? {})) {
    const values: readonly QueryValue[] = Array.isArray(raw) ? raw : [raw as QueryValue];
    for (const value of values) {
      if (value !== undefined && value !== "") url.searchParams.append(key, String(value));
    }
  }
  return url.toString();
}

/*
  Calls the server makes on its own account (page renders and cache refreshes, which have no
  visitor behind them) carry the shared token so the API does not rate-limit the web server as
  one anonymous client. Calls made for a visitor forward their address instead and stay limited
  per visitor. The token never reaches the browser: it is not a NEXT_PUBLIC_ variable.
*/
function internalToken(clientIp?: string): string | undefined {
  if (typeof window !== "undefined" || clientIp) return undefined;
  return process.env.INTERNAL_API_TOKEN || undefined;
}

type ErrorEnvelope = { error?: { code?: string; message?: string; fields?: FieldErrors } };

async function toApiError(response: Response): Promise<ApiError> {
  let envelope: ErrorEnvelope = {};
  try {
    envelope = (await response.json()) as ErrorEnvelope;
  } catch {
    // Non-JSON error bodies (proxy pages, gateway timeouts) fall through to the generic error.
  }
  const error = envelope.error;
  return new ApiError(
    response.status,
    error?.code ?? "bad_response",
    error?.message ?? `The archive did not answer properly (${response.status}).`,
    error?.fields ?? {},
  );
}

export async function apiRequest<S extends z.ZodTypeAny>(
  path: string,
  {
    method = "GET",
    body,
    token,
    schema,
    signal,
    query,
    clientIp,
    revalidate,
    tags,
  }: RequestOptions<S>,
): Promise<z.infer<S>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  if (clientIp) headers["X-Forwarded-For"] = clientIp;
  const internal = internalToken(clientIp);
  if (internal) headers["X-Internal-Token"] = internal;

  const cached = method === "GET" && !token && (revalidate !== undefined || tags !== undefined);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      ...(cached ? { next: { revalidate, tags } } : { cache: "no-store" as const }),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(0, "network_error", "Could not reach the archive. Check your connection.");
  }

  if (!response.ok) throw await toApiError(response);

  const json: unknown = response.status === 204 ? {} : await response.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(response.status, "bad_response", "The archive sent something unexpected.");
  }
  return parsed.data;
}
