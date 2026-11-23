import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getUser, isAdminEmail } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await getUser();
  if (!u || u.banned || !u.emailVerified || !isAdminEmail(u.email)) notFound();
  return (
    <>
      <AppHeader email={u.email} isAdmin />
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
        <nav aria-label="Admin" className="flex flex-wrap gap-2 text-sm">
          {[
            ["/admin", "Overview"],
            ["/admin/users", "Users"],
            ["/admin/jobs", "Jobs"],
            ["/admin/flags", "Flagged scripts"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="rounded-full border border-rule px-3 py-1.5 font-semibold hover:border-ink">
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6">
        {children}
      </main>
    </>
  );
}
