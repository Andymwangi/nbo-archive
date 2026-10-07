import { apiRequest } from "@/lib/api/client";
import { detailSchema } from "@/lib/api/types";

/*
  The drop list. Visitors join from the footer with a WhatsApp number, an email, or both, and an
  explicit consent tick; the API records which consent wording they agreed to.
*/

export type DropListSignup = {
  phone?: string;
  email?: string;
  consent: boolean;
  source?: string;
};

export function joinDropList(signup: DropListSignup, clientIp?: string) {
  return apiRequest("/alerts/drops/", {
    method: "POST",
    body: signup,
    clientIp,
    schema: detailSchema,
  });
}

export function leaveDropList(contact: { phone?: string; email?: string }, clientIp?: string) {
  return apiRequest("/alerts/drops/unsubscribe/", {
    method: "POST",
    body: contact,
    clientIp,
    schema: detailSchema,
  });
}
