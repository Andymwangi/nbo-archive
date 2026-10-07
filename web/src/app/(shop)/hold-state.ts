export type HoldActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

export const idleHoldState: HoldActionState = { status: "idle" };
