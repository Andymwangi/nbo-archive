import { Icon } from "@/components/primitives/Icon";
import { copy } from "@/content/copy";
import { contactDetails } from "@/lib/contact";

/*
  The floating chat button Kenyan shoppers look for. It only exists once the shop's WhatsApp
  number is configured, and it sits above the phone tab bar so it never covers navigation.
*/
export function WhatsAppButton() {
  const whatsapp = contactDetails().whatsapp;
  if (!whatsapp) return null;
  return (
    <a
      href={whatsapp.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={copy.nav.whatsappLabel}
      className="surface-ink fixed right-4 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 inline-flex min-h-12 items-center gap-2 rounded-hole px-4 meta no-underline hover:bg-signal hover:text-signal-ink lg:right-6 lg:bottom-6"
    >
      <Icon name="chat" size={20} />
      <span className="hidden sm:inline">{copy.nav.whatsapp}</span>
    </a>
  );
}
