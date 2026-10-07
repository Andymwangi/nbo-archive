import { imageSchema } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/errors";

/*
  Browser side of the photo upload route (app/admin/(desk)/accessions/[id]/photos/route.ts).
  Photos go one per request so a failure only costs that photo, and progress can be shown.
  The session cookies travel with the request; the route holds the token, never this code.
*/

type ErrorBody = { error?: { code?: string; message?: string } };

export async function uploadPiecePhoto(
  pieceId: number,
  file: File,
  kind: string,
  signal?: AbortSignal,
) {
  const form = new FormData();
  form.set("file", file, file.name);
  form.set("kind", kind);

  let response: Response;
  try {
    response = await fetch(`/admin/accessions/${pieceId}/photos`, {
      method: "POST",
      body: form,
      credentials: "same-origin",
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(0, "network_error", "Could not reach the archive. Check your connection.");
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // A login redirect or a proxy error page is not JSON; it is handled as a failure below.
  }
  if (!response.ok) {
    const error = (body as ErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "bad_response",
      error?.message ?? `The upload did not go through (${response.status}).`,
    );
  }
  const parsed = imageSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(response.status, "bad_response", "The archive sent something unexpected.");
  }
  return parsed.data;
}
