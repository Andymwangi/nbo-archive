import { copy } from "@/content/copy";

/*
  CLAIMED is a rubber stamp, not a greyed-out button: a double-ruled box in signal ink, set a
  few degrees off square as if pressed by hand. The piece stays visible under it; the record
  outlives the sale.
    frame  -- over a photo in the contact sheet
    record -- on the item page, with where and when it went
*/
type ClaimedStampProps = {
  variant?: "frame" | "record";
  detail?: string;
  className?: string;
};

export function ClaimedStamp({ variant = "frame", detail, className = "" }: ClaimedStampProps) {
  const record = variant === "record";
  return (
    <span
      className={`inline-flex -rotate-[7deg] flex-col items-center border-[3px] border-double border-signal px-3 py-1 text-signal ${
        record ? "gap-1 px-5 py-3" : ""
      } ${className}`}
    >
      <span
        className={`font-display leading-none font-bold tracking-[0.12em] uppercase ${
          record ? "text-title" : "text-lead"
        }`}
      >
        {copy.piece.claimed}
      </span>
      {detail ? <span className="meta">{detail}</span> : null}
    </span>
  );
}
