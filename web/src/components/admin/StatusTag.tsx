import { Tag } from "@/components/primitives/Tag";
import { copy } from "@/content/copy";
import type { DropStatus, PieceStatus } from "@/lib/api/admin";

/*
  Status hang-tags for the desk. Live gets the cleaned-and-inspected green because it is the
  state a buyer sees; held is the one that needs attention, so it takes signal.
*/
const pieceTones = {
  draft: "faint",
  scheduled: "ink",
  live: "tag",
  held: "signal",
  claimed: "ink",
  withdrawn: "faint",
} as const;

export function PieceStatusTag({ status }: { status: PieceStatus }) {
  return <Tag tone={pieceTones[status]}>{copy.pieceStatus[status]}</Tag>;
}

const dropTones = { draft: "faint", scheduled: "ink", released: "tag" } as const;

export function DropStatusTag({ status }: { status: DropStatus }) {
  return <Tag tone={dropTones[status]}>{copy.dropsDesk.status[status]}</Tag>;
}
