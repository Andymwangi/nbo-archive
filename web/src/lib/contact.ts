import "server-only";

/*
  How to reach the shop. Every value comes from the deployment's environment and is left out of
  the page entirely while it is unset: the site never shows a placeholder number or address.

  REQUIRES ENV: CONTACT_WHATSAPP, CONTACT_EMAIL, CONTACT_INSTAGRAM, CONTACT_CITY, CONTACT_HOURS
*/

export type ContactDetails = {
  whatsapp?: { display: string; href: string };
  email?: { display: string; href: string };
  instagram?: { display: string; href: string };
  city?: string;
  hours?: string;
};

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function contactDetails(): ContactDetails {
  const details: ContactDetails = {};

  const whatsapp = clean(process.env.CONTACT_WHATSAPP);
  const digits = whatsapp?.replace(/\D/g, "");
  if (whatsapp && digits) details.whatsapp = { display: whatsapp, href: `https://wa.me/${digits}` };

  const email = clean(process.env.CONTACT_EMAIL);
  if (email) details.email = { display: email, href: `mailto:${email}` };

  const instagram = clean(process.env.CONTACT_INSTAGRAM)?.replace(/^@/, "");
  if (instagram) {
    details.instagram = {
      display: `@${instagram}`,
      href: `https://www.instagram.com/${encodeURIComponent(instagram)}/`,
    };
  }

  details.city = clean(process.env.CONTACT_CITY);
  details.hours = clean(process.env.CONTACT_HOURS);
  return details;
}

export function hasContactDetails(details: ContactDetails): boolean {
  return Boolean(details.whatsapp || details.email || details.instagram);
}
