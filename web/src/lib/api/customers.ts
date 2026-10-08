import { z } from "zod";

import { apiRequest } from "@/lib/api/client";
import { detailSchema } from "@/lib/api/types";

/*
  Optional customer accounts. A customer signs in with a six-digit code sent by email; the web
  server keeps the session in an httpOnly cookie and passes it to the API as a header.
*/

export const customerSchema = z.object({
  email: z.string(),
  name: z.string(),
  phone: z.string(),
  email_verified_at: z.string().nullable(),
  created_at: z.string(),
});
export type Customer = z.infer<typeof customerSchema>;

const signedInSchema = z.object({ token: z.string(), customer: customerSchema });

export function requestCustomerCode(email: string, clientIp?: string) {
  return apiRequest("/customers/sign-in/", {
    method: "POST",
    body: { email },
    clientIp,
    schema: detailSchema,
  });
}

export function verifyCustomerCode(email: string, code: string, clientIp?: string) {
  return apiRequest("/customers/sign-in/verify/", {
    method: "POST",
    body: { email, code },
    clientIp,
    schema: signedInSchema,
  });
}

export function getCustomer(customerSession: string) {
  return apiRequest("/customers/me/", { customerSession, schema: customerSchema });
}

export function updateCustomer(
  customerSession: string,
  changes: Partial<Pick<Customer, "name" | "phone">>,
) {
  return apiRequest("/customers/me/", {
    method: "PATCH",
    customerSession,
    body: changes,
    schema: customerSchema,
  });
}

export function signOutCustomer(customerSession: string) {
  return apiRequest("/customers/sign-out/", {
    method: "POST",
    customerSession,
    schema: z.object({}),
  });
}
