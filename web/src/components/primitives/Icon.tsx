import { Icon as IconifyIcon } from "@iconify/react/offline";
import addSquare from "@iconify-icons/solar/add-square-linear";
import altArrowDown from "@iconify-icons/solar/alt-arrow-down-linear";
import altArrowLeft from "@iconify-icons/solar/alt-arrow-left-linear";
import altArrowRight from "@iconify-icons/solar/alt-arrow-right-linear";
import altArrowUp from "@iconify-icons/solar/alt-arrow-up-linear";
import arrowLeft from "@iconify-icons/solar/arrow-left-linear";
import arrowRight from "@iconify-icons/solar/arrow-right-linear";
import bag from "@iconify-icons/solar/bag-4-linear";
import calendar from "@iconify-icons/solar/calendar-linear";
import camera from "@iconify-icons/solar/camera-linear";
import chat from "@iconify-icons/solar/chat-round-dots-linear";
import checkCircle from "@iconify-icons/solar/check-circle-linear";
import clockCircle from "@iconify-icons/solar/clock-circle-linear";
import closeSquare from "@iconify-icons/solar/close-square-linear";
import delivery from "@iconify-icons/solar/delivery-linear";
import eye from "@iconify-icons/solar/eye-linear";
import letter from "@iconify-icons/solar/letter-linear";
import logout from "@iconify-icons/solar/logout-2-linear";
import hamburgerMenu from "@iconify-icons/solar/hamburger-menu-linear";
import home from "@iconify-icons/solar/home-2-linear";
import magnifer from "@iconify-icons/solar/magnifer-linear";
import moon from "@iconify-icons/solar/moon-linear";
import pause from "@iconify-icons/solar/pause-linear";
import pen from "@iconify-icons/solar/pen-linear";
import play from "@iconify-icons/solar/play-linear";
import refresh from "@iconify-icons/solar/refresh-linear";
import ruler from "@iconify-icons/solar/ruler-linear";
import shieldCheck from "@iconify-icons/solar/shield-check-linear";
import sun from "@iconify-icons/solar/sun-2-linear";
import trash from "@iconify-icons/solar/trash-bin-trash-linear";
import tuning from "@iconify-icons/solar/tuning-2-linear";
import upload from "@iconify-icons/solar/upload-linear";
import userPlus from "@iconify-icons/solar/user-plus-linear";
import userRounded from "@iconify-icons/solar/user-rounded-linear";
import widget from "@iconify-icons/solar/widget-4-linear";

/*
  Utility glyphs only. Garment motifs (stamps, labels, hang-tags) are drawn as custom SVG.
  Icon data is bundled per icon, so nothing is fetched from the Iconify API at runtime.
*/
const icons = {
  "arrow-left": arrowLeft,
  "arrow-right": arrowRight,
  bag,
  calendar,
  camera,
  chat,
  check: checkCircle,
  "chevron-down": altArrowDown,
  "chevron-left": altArrowLeft,
  "chevron-right": altArrowRight,
  "chevron-up": altArrowUp,
  clock: clockCircle,
  close: closeSquare,
  delivery,
  edit: pen,
  pause,
  play,
  eye,
  filter: tuning,
  grid: widget,
  home,
  letter,
  logout,
  menu: hamburgerMenu,
  moon,
  plus: addSquare,
  refresh,
  ruler,
  search: magnifer,
  "shield-check": shieldCheck,
  sun,
  trash,
  upload,
  "user-plus": userPlus,
  user: userRounded,
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
