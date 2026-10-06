export type ApiErrorCode =
  | "network_error"
  | "bad_response"
  | "validation_error"
  | "invalid_link"
  | "token_not_valid"
  | "no_active_account"
  | "not_authenticated"
  | "authentication_failed"
  | "permission_denied"
  | "not_found"
  | "throttled"
  | "conflict"
  | "gone"
  | (string & {});

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fields: FieldErrors;

  constructor(status: number, code: ApiErrorCode, message: string, fields: FieldErrors = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  get isAuthFailure(): boolean {
    return this.status === 401;
  }

  fieldMessage(field: string): string | undefined {
    return this.fields[field]?.[0];
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
