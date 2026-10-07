export type FormState = {
  status: "idle" | "ok" | "error";
  message?: string;
  fields?: Record<string, string>;
  /** What the person submitted, echoed back so React's post-action form reset keeps it. */
  values?: Record<string, string>;
  email?: string;
};

export const idleState: FormState = { status: "idle" };
