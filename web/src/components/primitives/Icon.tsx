import { Icon as IconifyIcon } from "@iconify/react/offline";
import altArrowLeft from "@iconify-icons/solar/alt-arrow-left-linear";
import altArrowRight from "@iconify-icons/solar/alt-arrow-right-linear";
import arrowLeft from "@iconify-icons/solar/arrow-left-linear";
import arrowRight from "@iconify-icons/solar/arrow-right-linear";
import clockCircle from "@iconify-icons/solar/clock-circle-linear";
import closeSquare from "@iconify-icons/solar/close-square-linear";
import letter from "@iconify-icons/solar/letter-linear";
import logout from "@iconify-icons/solar/logout-2-linear";
import magnifer from "@iconify-icons/solar/magnifer-linear";
import refresh from "@iconify-icons/solar/refresh-linear";
import tuning from "@iconify-icons/solar/tuning-2-linear";
import userPlus from "@iconify-icons/solar/user-plus-linear";

/*
  Utility glyphs only. Garment motifs (stamps, labels, hang-tags) are drawn as custom SVG.
  Icon data is bundled per icon, so nothing is fetched from the Iconify API at runtime.
*/
const icons = {
  "arrow-left": arrowLeft,
  "arrow-right": arrowRight,
  "chevron-left": altArrowLeft,
  "chevron-right": altArrowRight,
  clock: clockCircle,
  close: closeSquare,
  filter: tuning,
  letter,
  logout,
  refresh,
  search: magnifer,
  "user-plus": userPlus,
} as const;

export type IconName = keyof typeof icons;

type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
};

/** Decorative only: every icon sits beside visible text or inside a labelled control. */
export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <IconifyIcon icon={icons[name]} width={size} height={size} className={className} aria-hidden />
  );
}
