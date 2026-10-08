import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { type Customer, getCustomer } from "@/lib/api/customers";
import { isApiError } from "@/lib/api/errors";

/*
  The signed-in customer, if any. The session token lives in an httpOnly cookie that page
  scripts cannot read; it is set and cleared only by Server Actions.
*/

export const CUSTOMER_COOKIE = "nbo_customer";
export const CUSTOMER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function readCustomerSession(): Promise<string | undefined> {
  return (await cookies()).get(CUSTOMER_COOKIE)?.value;
}

/** The customer for this request, fetched once and shared by the layout and the page. A
 *  storefront page must still render when the API is down, so failures read as signed out. */
export const currentCustomer = cache(async (): Promise<Customer | null> => {
  const session = await readCustomerSession();
  if (!session) return null;
  try {
    return await getCustomer(session);
  } catch (error) {
    if (isApiError(error)) return null;
    throw error;
  }
});
