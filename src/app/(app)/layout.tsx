import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { isAdminEmail, getUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await getUser();
  if (!u) redirect("/login");
  if (u.banned) redirect("/login?error=account_suspended");
  return (
    <>
      <AppHeader email={u.email} isAdmin={u.emailVerified && isAdminEmail(u.email)} />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-24 pt-4 sm:px-6">
        {children}
      </main>
    </>
  );
}
