import { redirect } from "next/navigation";

import { LoginForm } from "@/app/admin/(auth)/login/LoginForm";
import { readSessionTokens } from "@/lib/session";

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { reason } = await searchParams;
  const expired = reason === "expired";

  const { refresh } = await readSessionTokens();
  if (refresh && !expired) redirect("/admin");

  return <LoginForm expired={expired} />;
}
