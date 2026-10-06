import type { z } from "zod";

import { ApiError, type FieldErrors } from "@/lib/api/errors";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type RequestOptions<S extends z.ZodTypeAny> = {
  method?: Method;
  body?: unknown;
  token?: string;
  schema: S;
  signal?: AbortSignal;
  query?: Record<string, string | number | undefined>;
  /** Visitor address to forward on unauthenticated calls made from the server. */
  clientIp?: string;
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

function buildUrl(path: string, query?: RequestOptions<z.ZodTypeAny>["query"]): string {
  const url = new URL(`${baseUrl()}${API_PREFIX}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
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
  { method = "GET", body, token, schema, signal, query, clientIp }: RequestOptions<S>,
): Promise<z.infer<S>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  if (clientIp) headers["X-Forwarded-For"] = clientIp;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      cache: "no-store",
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
