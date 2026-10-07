import { Colophon } from "@/components/layout/Colophon";
import { IndexNav } from "@/components/layout/IndexNav";
import { currentHolds } from "@/lib/visitor";

export default async function ShopLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const holds = await currentHolds();
  return (
    <>
      <IndexNav holdCount={holds.length} />
      <main className="mx-auto max-w-[90rem] px-4 pt-8 md:px-8 md:pt-12">{children}</main>
      <Colophon />
    </>
  );
}
