import { Colophon } from "@/components/layout/Colophon";
import { IndexNav } from "@/components/layout/IndexNav";

export default function ShopLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <IndexNav />
      <main className="mx-auto max-w-[90rem] px-4 pt-8 md:px-8 md:pt-12">{children}</main>
      <Colophon />
    </>
  );
}
