import { redirect } from "next/navigation";
import { ViewTransition } from "react";
import { AppHeader } from "@/components/AppHeader";
import { getUser, isAdminEmail } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await getUser();
  if (!u) redirect("/login");
  if (u.banned) redirect("/login?error=account_suspended");
  return (
    <>
      <AppHeader email={u.email} isAdmin={u.emailVerified && isAdminEmail(u.email)} />
      <ViewTransition>
        <main id="main" className="mx-auto w-full max-w-[1240px] px-5 pb-28 pt-10 sm:px-8">
          {children}
        </main>
      </ViewTransition>
    </>
  );
}
