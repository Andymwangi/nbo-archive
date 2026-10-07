import { Colophon } from "@/components/layout/Colophon";
import { IndexNav } from "@/components/layout/IndexNav";
import { readTheme } from "@/lib/theme-server";
import { currentHolds } from "@/lib/visitor";

export default async function ShopLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [holds, theme] = await Promise.all([currentHolds(), readTheme()]);
  return (
    <>
      <IndexNav holdCount={holds.length} theme={theme} />
      <main className="mx-auto max-w-[90rem] px-4 pt-8 md:px-8 md:pt-12">{children}</main>
      <Colophon />
    </>
  );
}
