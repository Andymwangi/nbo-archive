import { copy } from "@/content/copy";
import { isApiError } from "@/lib/api/errors";
import type { FormState } from "@/lib/form-state";

/*
  Shared by the desk's Server Actions. Kept out of the "use server" files so these helpers are
  not exposed as callable actions themselves.
*/

/** Turn an API failure into something a person can act on; never echo transport internals. */
export function failure(
  error: unknown,
  {
    fieldNames = [],
    values,
    notFound = copy.errors.unexpected,
  }: {
    fieldNames?: readonly string[];
    values?: Record<string, string>;
    notFound?: string;
  } = {},
): FormState {
  if (!isApiError(error)) throw error;
  const base = { status: "error" as const, values };
  if (error.code === "network_error") return { ...base, message: copy.errors.network };
  if (error.code === "throttled") return { ...base, message: copy.errors.throttled };
  if (error.status === 401) return { ...base, message: copy.errors.sessionEnded };
  if (error.status === 404) return { ...base, message: notFound };
  if (error.status >= 500 || error.code === "bad_response") {
    return { ...base, message: copy.errors.unexpected };
  }

  const fields: Record<string, string> = {};
  for (const name of fieldNames) {
    const message = error.fieldMessage(name);
    if (message) fields[name] = message;
  }
  const unclaimed = Object.keys(error.fields).some((name) => !fieldNames.includes(name));
  const message = Object.keys(fields).length && !unclaimed ? undefined : error.message;
  return { ...base, message, fields };
}

export function stringValues(formData: FormData, names: readonly string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of names) {
    const value = formData.get(name);
    if (typeof value === "string") values[name] = value;
  }
  return values;
}
