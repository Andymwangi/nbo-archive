import { Icon as IconifyIcon } from "@iconify/react/offline";
import addSquare from "@iconify-icons/solar/add-square-linear";
import altArrowDown from "@iconify-icons/solar/alt-arrow-down-linear";
import altArrowLeft from "@iconify-icons/solar/alt-arrow-left-linear";
import altArrowRight from "@iconify-icons/solar/alt-arrow-right-linear";
import altArrowUp from "@iconify-icons/solar/alt-arrow-up-linear";
import arrowLeft from "@iconify-icons/solar/arrow-left-linear";
import arrowRight from "@iconify-icons/solar/arrow-right-linear";
import calendar from "@iconify-icons/solar/calendar-linear";
import checkCircle from "@iconify-icons/solar/check-circle-linear";
import clockCircle from "@iconify-icons/solar/clock-circle-linear";
import closeSquare from "@iconify-icons/solar/close-square-linear";
import eye from "@iconify-icons/solar/eye-linear";
import letter from "@iconify-icons/solar/letter-linear";
import logout from "@iconify-icons/solar/logout-2-linear";
import hamburgerMenu from "@iconify-icons/solar/hamburger-menu-linear";
import magnifer from "@iconify-icons/solar/magnifer-linear";
import moon from "@iconify-icons/solar/moon-linear";
import pen from "@iconify-icons/solar/pen-linear";
import refresh from "@iconify-icons/solar/refresh-linear";
import sun from "@iconify-icons/solar/sun-2-linear";
import trash from "@iconify-icons/solar/trash-bin-trash-linear";
import tuning from "@iconify-icons/solar/tuning-2-linear";
import upload from "@iconify-icons/solar/upload-linear";
import userPlus from "@iconify-icons/solar/user-plus-linear";
import widget from "@iconify-icons/solar/widget-4-linear";

/*
  Utility glyphs only. Garment motifs (stamps, labels, hang-tags) are drawn as custom SVG.
  Icon data is bundled per icon, so nothing is fetched from the Iconify API at runtime.
*/
const icons = {
  "arrow-left": arrowLeft,
  "arrow-right": arrowRight,
  calendar,
  check: checkCircle,
  "chevron-down": altArrowDown,
  "chevron-left": altArrowLeft,
  "chevron-right": altArrowRight,
  "chevron-up": altArrowUp,
  clock: clockCircle,
  close: closeSquare,
  edit: pen,
  eye,
  filter: tuning,
  grid: widget,
  letter,
  logout,
  menu: hamburgerMenu,
  moon,
  plus: addSquare,
  refresh,
  search: magnifer,
  sun,
  trash,
  upload,
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
