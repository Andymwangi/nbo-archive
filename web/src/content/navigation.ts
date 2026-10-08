import { copy } from "@/content/copy";
import { categories } from "@/lib/categories";

/*
  Every navigation list in one place, so the header, the phone menu and the footer cannot drift
  apart. Labels come from copy.ts.
*/

export type NavLink = { href: string; label: string };

export const sectionLinks: (NavLink & { match: (path: string) => boolean })[] = [
  { href: "/", label: copy.nav.latest, match: (path) => path === "/" },
  {
    href: "/archive",
    label: copy.nav.archive,
    match: (path) => path.startsWith("/archive") || path.startsWith("/item"),
  },
  { href: "/drops", label: copy.nav.drops, match: (path) => path.startsWith("/drops") },
];

export const categoryLinks: NavLink[] = categories.map((category) => ({
  href: `/archive?category=${category}`,
  label: copy.labels.categoryPlural[category],
}));

const l = copy.footer.links;

const howHoldsLink: NavLink = { href: "/help/holds", label: l.howHolds };

const otherHelpLinks: NavLink[] = [
  { href: "/help/sizing", label: l.sizing },
  { href: "/policies/shipping", label: l.shipping },
  { href: "/policies/returns", label: l.returns },
];

/** Help links; "How holds work" only while holds are open. */
export function helpLinks(holdsOpen: boolean): NavLink[] {
  return [...(holdsOpen ? [howHoldsLink] : []), ...otherHelpLinks];
}

export const archiveLinks: NavLink[] = [
  { href: "/about", label: l.about },
  { href: "/contact", label: l.contact },
];

export const legalLinks: NavLink[] = [
  { href: "/policies/privacy", label: l.privacy },
  { href: "/policies/terms", label: l.terms },
];

/** The header's main menu: new in, shop all, every category, then accessions. */
export const mainNavLinks: (NavLink & { category?: string; match: (path: string) => boolean })[] = [
  { href: "/", label: copy.nav.newIn, match: (path) => path === "/" },
  { href: "/archive", label: copy.nav.shopAll, match: (path) => path.startsWith("/archive") },
  ...categories.map((category) => ({
    href: `/archive?category=${category}`,
    label: copy.labels.categoryPlural[category],
    category,
    match: (path: string) => path.startsWith("/archive"),
  })),
  { href: "/drops", label: copy.nav.drops, match: (path) => path.startsWith("/drops") },
];
