"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { copy } from "@/content/copy";
import {
  requestCustomerCode,
  signOutCustomer,
  updateCustomer,
  verifyCustomerCode,
} from "@/lib/api/customers";
import { isApiError } from "@/lib/api/errors";
import { visitorIpFrom } from "@/lib/client-ip";
import { CUSTOMER_COOKIE, CUSTOMER_COOKIE_MAX_AGE, readCustomerSession } from "@/lib/customer";
import type { FormState } from "@/lib/form-state";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function failure(error: unknown, values: Record<string, string>): FormState {
  if (!isApiError(error)) throw error;
  if (error.code === "network_error") {
    return { status: "error", values, message: copy.errors.network };
  }
  if (error.code === "throttled")
    return { status: "error", values, message: copy.errors.throttled };
  if (error.code === "invalid_code") {
    return { status: "error", values, fields: { code: copy.account.invalidCode } };
  }
  if (error.code === "validation_error") {
    const fields: Record<string, string> = {};
    for (const name of ["email", "code", "name", "phone"]) {
      const message = error.fieldMessage(name);
      if (message) fields[name] = message;
    }
    return Object.keys(fields).length
      ? { status: "error", values, fields }
      : { status: "error", values, message: error.message };
  }
  return { status: "error", values, message: copy.errors.unexpected };
}

export async function requestCodeAction(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL.test(email)) {
    return { status: "error", values: { email }, fields: { email: copy.account.invalidEmail } };
  }
  try {
    await requestCustomerCode(email, visitorIpFrom(await headers()));
  } catch (error) {
    return failure(error, { email });
  }
  return { status: "ok", email };
}

export async function verifyCodeAction(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) {
    return {
      status: "ok",
      email,
      values: { code },
      fields: { code: copy.account.invalidCode },
    };
  }
  try {
    const signedIn = await verifyCustomerCode(email, code, visitorIpFrom(await headers()));
    (await cookies()).set(CUSTOMER_COOKIE, signedIn.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CUSTOMER_COOKIE_MAX_AGE,
    });
  } catch (error) {
    // Stay on the code step: the address is fine, only the code needs another try.
    return { ...failure(error, { code }), status: "ok", email };
  }
  redirect("/account");
}

export async function updateProfileAction(_: FormState, formData: FormData): Promise<FormState> {
  const session = await readCustomerSession();
  if (!session) redirect("/account/sign-in");
  const values = {
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
  };
  try {
    await updateCustomer(session, values);
  } catch (error) {
    if (isApiError(error) && error.code === "not_signed_in") redirect("/account/sign-in");
    return failure(error, values);
  }
  return { status: "ok", values, message: copy.account.saved };
}

export async function signOutCustomerAction(): Promise<void> {
  const session = await readCustomerSession();
  if (session) {
    try {
      await signOutCustomer(session);
    } catch (error) {
      // The cookie goes either way; an unreachable API must not trap someone signed in.
      if (!isApiError(error)) throw error;
    }
  }
  (await cookies()).delete(CUSTOMER_COOKIE);
  redirect("/");
}
