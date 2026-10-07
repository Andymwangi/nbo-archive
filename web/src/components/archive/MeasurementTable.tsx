import { copy } from "@/content/copy";

/*
  Measurements instead of a size chart. Each one is a tape-measure line drawn to scale against
  the longest, so the shape of the garment reads before the numbers do.
*/
const ORDER = ["chest", "length", "shoulder", "sleeve"] as const;

export function MeasurementTable({ measurements }: { measurements: Record<string, number> }) {
  const rows = ORDER.filter((key) => typeof measurements[key] === "number").map((key) => ({
    key,
    cm: measurements[key]!,
  }));
  if (rows.length === 0) return null;
  const longest = Math.max(...rows.map((row) => row.cm));

  return (
    <section aria-labelledby="measurements-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="measurements-title" className="font-display text-title">
          {copy.item.measurementsTitle}
        </h2>
        <p className="text-meta text-ink-muted">{copy.item.measurementsCaption}</p>
      </div>
      <table className="w-full border-collapse">
        <caption className="sr-only">{copy.item.measurementsCaption}</caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-ink/25">
              <th scope="row" className="w-[45%] py-3 pr-4 text-left align-top font-normal">
                <span className="meta text-ink-muted">{copy.labels.measurement[row.key]}</span>
              </th>
              <td className="py-3 align-top">
                <div className="flex items-center gap-3">
                  <span className="w-16 shrink-0 font-meta text-lead tabular-nums">
                    {row.cm}
                    <span className="text-meta text-ink-muted"> cm</span>
                  </span>
                  <span aria-hidden className="relative h-3 flex-1">
                    <span
                      className="absolute inset-y-0 left-0 border-x-[1.5px] border-ink bg-[repeating-linear-gradient(90deg,var(--ink)_0_1px,transparent_1px_8px)] bg-[length:100%_45%] bg-bottom bg-no-repeat"
                      style={{ width: `${(row.cm / longest) * 100}%` }}
                    />
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
