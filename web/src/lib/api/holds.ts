import { z } from "zod";

import { pieceCardSchema } from "@/lib/api/catalog";
import { apiRequest } from "@/lib/api/client";

/*
  Holds belong to a visitor, identified only by the random key in their cookie. Nothing here is
  cached: every answer is specific to one visitor and changes by the second.
*/

export const holdSchema = z.object({
  id: z.number().int(),
  status: z.enum(["active", "converted", "released", "expired"]),
  expires_at: z.string(),
  created_at: z.string(),
  piece: pieceCardSchema,
});
export type Hold = z.infer<typeof holdSchema>;

export const MAX_ACTIVE_HOLDS = 3;

/** Reading holds happens on every storefront render for visitors with a cookie, so it goes on
 *  the web server's own account rather than counting against the visitor's address. */
export function listMyHolds(visitorToken: string) {
  return apiRequest("/holds/", { visitorToken, schema: z.array(holdSchema) });
}

export function placeHold(visitorToken: string, archiveNo: string, clientIp?: string) {
  return apiRequest("/holds/", {
    method: "POST",
    visitorToken,
    clientIp,
    body: { archive_no: archiveNo },
    schema: holdSchema,
  });
}

export function releaseHold(visitorToken: string, holdId: number, clientIp?: string) {
  return apiRequest(`/holds/${holdId}/`, {
    method: "DELETE",
    visitorToken,
    clientIp,
    schema: z.object({}),
  });
}
