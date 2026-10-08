import { MobileTabBar } from "@/components/shell/MobileTabBar";
import { PulseStrip } from "@/components/shell/PulseStrip";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { WhatsAppButton } from "@/components/shell/WhatsAppButton";
import { copy } from "@/content/copy";
import { type Pulse, getPulse } from "@/lib/api/drops";
import { isApiError } from "@/lib/api/errors";
import { readTheme } from "@/lib/theme-server";
import { currentHolds, holdsEnabled } from "@/lib/visitor";

/** The strip is a garnish: an unreachable API must not take every page down with it. */
async function safePulse(): Promise<Pulse | null> {
  try {
    return await getPulse();
  } catch (error) {
    if (isApiError(error)) return null;
    throw error;
  }
}

export default async function ShopLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [holds, theme, pulse] = await Promise.all([currentHolds(), readTheme(), safePulse()]);
  const holdsOpen = holdsEnabled();

  return (
    <div className="pb-[calc(3.5rem+2px+env(safe-area-inset-bottom))] lg:pb-0">
      <a
        href="#main"
        className="sr-only z-50 bg-ink px-4 py-3 meta text-paper focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {copy.shell.skip}
      </a>
      <PulseStrip pulse={pulse} />
      <SiteHeader holdCount={holds.length} holdsOpen={holdsOpen} theme={theme} />
      <main id="main" className="mx-auto max-w-[90rem] px-4 pt-8 md:px-8 md:pt-12">
        {children}
      </main>
      <SiteFooter holdsOpen={holdsOpen} nextDrop={pulse?.next_drop ?? null} now={new Date()} />
      <WhatsAppButton />
      <MobileTabBar holdCount={holds.length} holdsOpen={holdsOpen} />
    </div>
  );
}
