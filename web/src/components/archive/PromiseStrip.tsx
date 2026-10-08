import { Icon, type IconName } from "@/components/primitives/Icon";
import { copy } from "@/content/copy";

const icons: IconName[] = ["shield-check", "ruler", "camera", "delivery"];

/** The shop's promises in one band, each one a fact about how every piece is handled. */
export function PromiseStrip() {
  return (
    <ul className="grid grid-cols-2 gap-px border-y-[1.5px] border-ink bg-ink/25 md:grid-cols-4">
      {copy.home.promises.map((promise, index) => (
        <li key={promise} className="flex items-center gap-3 bg-paper px-3 py-4 meta">
          <Icon name={icons[index] ?? "check"} size={20} className="shrink-0" />
          {promise}
        </li>
      ))}
    </ul>
  );
}
