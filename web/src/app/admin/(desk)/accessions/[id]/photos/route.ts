import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

import { copy } from "@/content/copy";
import { imageKindSchema, MAX_UPLOAD_BYTES, uploadPhoto } from "@/lib/api/admin";
import { getMe, refreshAccess } from "@/lib/api/auth";
import { catalogTags } from "@/lib/api/catalog";
import { isApiError } from "@/lib/api/errors";
import { visitorIpFrom } from "@/lib/client-ip";
import {
  ACCESS_COOKIE,
  ACCESS_REFRESH_LEEWAY_SECONDS,
  REFRESH_COOKIE,
  secondsUntilExpiry,
  writeAccessCookie,
} from "@/lib/session-cookies";

/*
  One photo per request, streamed on to the API. This is a Route Handler rather than a Server
  Action because photos run to 15 MB: Server Actions cap bodies at 1 MB, and proxy.ts would
  buffer and silently truncate anything over 10 MB. proxy.ts therefore skips this path, and the
  handler does its own session work: same-origin check, access refresh, role check.
*/

type Failure = { code: string; message: string; status: number };

function fail({ code, message, status }: Failure): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext<"/admin/accessions/[id]/photos">,
) {
  if (!sameOrigin(request)) {
    return fail({ code: "permission_denied", message: copy.errors.unexpected, status: 403 });
  }
  const pieceId = Number((await params).id);
  if (!Number.isInteger(pieceId) || pieceId <= 0) {
    return fail({ code: "not_found", message: copy.accessionsDesk.gone, status: 404 });
  }

  const sessionEnded = {
    code: "not_authenticated",
    message: copy.errors.sessionEnded,
    status: 401,
  };
  let access = request.cookies.get(ACCESS_COOKIE)?.value;
  let refreshed: string | undefined;
  if (!access || secondsUntilExpiry(access) <= ACCESS_REFRESH_LEEWAY_SECONDS) {
    const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
    if (!refresh) return fail(sessionEnded);
    try {
      refreshed = (await refreshAccess(refresh, visitorIpFrom(request.headers))).access;
      access = refreshed;
    } catch (error) {
      if (isApiError(error) && error.isAuthFailure) return fail(sessionEnded);
      return fail({ code: "network_error", message: copy.errors.network, status: 503 });
    }
  }

  const respond = (response: NextResponse) => {
    if (refreshed) writeAccessCookie(response.cookies, refreshed);
    return response;
  };

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return respond(
      fail({ code: "validation_error", message: copy.photosDesk.pickFiles, status: 400 }),
    );
  }
  const file = form.get("file");
  const kind = imageKindSchema.safeParse(form.get("kind"));
  const alt = form.get("alt_text");
  if (!(file instanceof File) || file.size === 0 || !kind.success) {
    return respond(
      fail({ code: "validation_error", message: copy.photosDesk.pickFiles, status: 400 }),
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return respond(
      fail({ code: "validation_error", message: copy.photosDesk.tooBig, status: 400 }),
    );
  }

  try {
    const user = await getMe(access);
    if (user.role !== "owner" && user.role !== "editor") {
      return respond(
        fail({ code: "permission_denied", message: copy.pieceDesk.readOnly, status: 403 }),
      );
    }
    const upstream = new FormData();
    upstream.set("file", file, file.name);
    upstream.set("kind", kind.data);
    if (typeof alt === "string" && alt.trim()) upstream.set("alt_text", alt.trim().slice(0, 160));
    const image = await uploadPhoto(access, pieceId, upstream);
    revalidateTag(catalogTags.all, { expire: 0 });
    return respond(NextResponse.json(image, { status: 201 }));
  } catch (error) {
    if (!isApiError(error)) throw error;
    if (error.isAuthFailure) return respond(fail(sessionEnded));
    if (error.code === "network_error") {
      return respond(fail({ code: error.code, message: copy.errors.network, status: 503 }));
    }
    if (error.status === 404) {
      return respond(fail({ code: "not_found", message: copy.accessionsDesk.gone, status: 404 }));
    }
    if (error.status >= 500 || error.code === "bad_response") {
      return respond(fail({ code: "bad_response", message: copy.errors.unexpected, status: 502 }));
    }
    // 400 (bad file, photo limit) and 409 (held or claimed) carry a message meant for people.
    return respond(
      fail({
        code: error.code,
        message: error.fieldMessage("file") ?? error.message,
        status: error.status,
      }),
    );
  }
}
