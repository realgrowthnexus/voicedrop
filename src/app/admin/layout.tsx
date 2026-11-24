import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { requireAdminPage } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await requireAdminPage();
  return (
    <>
      <AppHeader email={u.email} isAdmin />
      <div className="mx-auto w-full max-w-[1240px] px-5 pt-6 sm:px-8">
        <nav aria-label="Admin" className="flex flex-wrap gap-2 text-sm">
          {[
            ["/admin", "Overview"],
            ["/admin/users", "Users"],
            ["/admin/jobs", "Jobs"],
            ["/admin/flags", "Flagged scripts"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="btn btn-secondary btn-sm">
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <main id="main" className="mx-auto w-full max-w-[1240px] px-5 pb-24 pt-6 sm:px-8">
        {children}
      </main>
    </>
  );
}
