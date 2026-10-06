import { Icon as IconifyIcon } from "@iconify/react/offline";
import arrowRight from "@iconify-icons/solar/arrow-right-linear";
import closeSquare from "@iconify-icons/solar/close-square-linear";
import letter from "@iconify-icons/solar/letter-linear";
import logout from "@iconify-icons/solar/logout-2-linear";
import refresh from "@iconify-icons/solar/refresh-linear";
import userPlus from "@iconify-icons/solar/user-plus-linear";

/*
  Utility glyphs only. Garment motifs (stamps, labels, hang-tags) are drawn as custom SVG.
  Icon data is bundled per icon, so nothing is fetched from the Iconify API at runtime.
*/
const icons = {
  "arrow-right": arrowRight,
  close: closeSquare,
  letter,
  logout,
  refresh,
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
