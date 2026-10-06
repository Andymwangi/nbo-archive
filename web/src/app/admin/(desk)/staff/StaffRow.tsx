"use client";

import { useActionState } from "react";

import { updateStaffAction } from "@/app/admin/actions";
import { idleState } from "@/app/admin/form-state";
import { FormNote } from "@/components/form/Field";
import { Button } from "@/components/primitives/Button";
import { Tag } from "@/components/primitives/Tag";
import { copy } from "@/content/copy";
import { type AdminUser, adminRoleSchema } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";

export function StaffRow({ member, isSelf }: { member: AdminUser; isSelf: boolean }) {
  // One action state for both forms on the row, so only the latest outcome is ever shown.
  const [state, formAction, pending] = useActionState(updateStaffAction, idleState);
  const displayName = member.name || member.email;
  const roleLocked = isSelf || !member.is_active;

  return (
    <li
      className={`grid gap-4 border-b border-ink py-5 md:grid-cols-[minmax(0,1fr)_14rem_10rem] md:items-start md:gap-6 ${member.is_active ? "" : "text-ink-muted"}`}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-display text-lead">{displayName}</span>
          {isSelf ? <Tag tone="faint">{copy.staff.you}</Tag> : null}
          {!member.is_active ? <Tag tone="faint">{copy.staff.inactive}</Tag> : null}
        </p>
        <p className="truncate font-meta text-meta text-ink-muted">{member.email}</p>
        {member.phone ? <p className="font-meta text-meta text-ink-muted">{member.phone}</p> : null}
        {!isSelf ? (
          <form action={formAction} className="pt-1">
            <input type="hidden" name="id" value={member.id} />
            <input
              type="hidden"
              name="intent"
              value={member.is_active ? "deactivate" : "reactivate"}
            />
            <Button
              type="submit"
              variant={member.is_active ? "danger" : "quiet"}
              className="min-h-11"
              disabled={pending}
              aria-label={
                member.is_active
                  ? copy.staff.deactivateLabel(displayName)
                  : copy.staff.reactivateLabel(displayName)
              }
            >
              {member.is_active ? copy.staff.deactivate : copy.staff.reactivate}
            </Button>
          </form>
        ) : null}
      </div>

      <form action={formAction} className="flex flex-col gap-1">
        <input type="hidden" name="id" value={member.id} />
        <input type="hidden" name="intent" value="role" />
        <div className="flex items-end gap-3">
          <label className="flex flex-1 flex-col gap-1">
            <span className="meta text-ink-muted md:sr-only">
              {copy.staff.roleLabelFor(displayName)}
            </span>
            <select
              name="role"
              defaultValue={member.role}
              disabled={roleLocked}
              className="min-h-11 border-0 border-b-[1.5px] border-ink bg-transparent font-meta text-meta uppercase disabled:border-ink-faint"
            >
              {adminRoleSchema.options.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          {!roleLocked ? (
            <Button type="submit" variant="quiet" className="min-h-11" disabled={pending}>
              {copy.staff.save}
            </Button>
          ) : null}
        </div>
        {isSelf ? <p className="text-meta text-ink-muted">{copy.staff.selfRoleLocked}</p> : null}
      </form>

      <p className="font-meta text-meta text-ink-muted">
        <span className="md:sr-only">{copy.staff.columns.lastSeen}: </span>
        {member.last_login ? formatDateTime(member.last_login) : copy.staff.neverSignedIn}
      </p>

      {state.status !== "idle" && state.message ? (
        <div className="md:col-span-3">
          <FormNote tone={state.status === "ok" ? "ok" : "error"}>{state.message}</FormNote>
        </div>
      ) : null}
    </li>
  );
}
