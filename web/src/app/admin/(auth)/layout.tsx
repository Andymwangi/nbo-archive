import type { Metadata } from "next";

import { copy } from "@/content/copy";

export const metadata: Metadata = {
  title: copy.brand.backRoom,
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh md:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
      <aside className="flex items-center justify-between border-b-[1.5px] border-ink px-5 py-3 md:flex-col md:items-start md:border-r-[1.5px] md:border-b-0 md:px-10 md:py-10">
        <p className="meta">
          {copy.brand.name} / {copy.brand.backRoom}
        </p>
        <p aria-hidden className="hidden font-display text-numeral text-ink select-none md:block">
          NBO
          <span className="block text-signal">0000</span>
        </p>
        <p className="meta text-ink-muted">Staff entrance / Nairobi</p>
      </aside>
      <div className="flex flex-col justify-center px-5 py-10 sm:px-10 md:px-12">{children}</div>
    </main>
  );
}
