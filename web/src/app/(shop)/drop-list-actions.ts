"use server";

import { headers } from "next/headers";

import { copy } from "@/content/copy";
import { joinDropList, leaveDropList } from "@/lib/api/alerts";
import { isApiError } from "@/lib/api/errors";
import { visitorIpFrom } from "@/lib/client-ip";
import type { FormState } from "@/lib/form-state";

function failure(error: unknown, values: Record<string, string>): FormState {
  if (!isApiError(error)) throw error;
  if (error.code === "network_error") {
    return { status: "error", values, message: copy.errors.network };
  }
  if (error.code === "throttled") {
    return { status: "error", values, message: copy.errors.throttled };
  }
  if (error.code === "validation_error") {
    const fields: Record<string, string> = {};
    for (const name of ["phone", "email", "consent"]) {
      const message = error.fieldMessage(name);
      if (message) fields[name] = message;
    }
    return Object.keys(fields).length
      ? { status: "error", values, fields }
      : { status: "error", values, message: error.message };
  }
  return { status: "error", values, message: copy.errors.unexpected };
}

// Length and format are checked by the API, which answers with field errors; here the input is
// only trimmed, so an over-long paste becomes a message under the field rather than a crash.
function readContact(formData: FormData) {
  const values = {
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  return { values, contact: { phone: values.phone.trim(), email: values.email.trim() } };
}

export async function joinDropListAction(_: FormState, formData: FormData): Promise<FormState> {
  const { values, contact } = readContact(formData);
  const consent = formData.get("consent") === "on";
  const echoed = { ...values, consent: consent ? "on" : "" };

  const fields: Record<string, string> = {};
  if (!contact.phone && !contact.email) fields.phone = copy.footer.needContact;
  if (!consent) fields.consent = copy.footer.needConsent;
  if (Object.keys(fields).length) return { status: "error", values: echoed, fields };

  try {
    await joinDropList(
      {
        phone: contact.phone || undefined,
        email: contact.email || undefined,
        consent: true,
        source: "footer",
      },
      visitorIpFrom(await headers()),
    );
  } catch (error) {
    return failure(error, echoed);
  }
  return { status: "ok", message: copy.footer.joined };
}

export async function leaveDropListAction(_: FormState, formData: FormData): Promise<FormState> {
  const { values, contact } = readContact(formData);
  if (!contact.phone && !contact.email) {
    return { status: "error", values, fields: { phone: copy.footer.needContact } };
  }
  try {
    await leaveDropList(
      { phone: contact.phone || undefined, email: contact.email || undefined },
      visitorIpFrom(await headers()),
    );
  } catch (error) {
    return failure(error, values);
  }
  return { status: "ok", message: copy.pages.left };
}
