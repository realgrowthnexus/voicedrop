"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/dashboard", label: "Studio" },
  { href: "/history", label: "History" },
  { href: "/billing", label: "Plan & billing" },
];

export function AppHeader({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const items = isAdmin ? [...NAV, { href: "/admin", label: "Admin" }] : NAV;
  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Logo href="/dashboard" />
        <div className="flex items-center gap-1">
          <span className="hidden max-w-[16rem] truncate text-sm text-graphite md:inline">{email}</span>
          <ThemeToggle />
          <button type="button" onClick={signOut} className="rounded-full px-3 py-2 text-sm font-semibold text-graphite hover:text-ink">
            Sign out
          </button>
        </div>
        <nav aria-label="App" className="-mx-1 flex w-full gap-1 overflow-x-auto sm:w-auto sm:order-none">
          {items.map((n) => {
            const active = path === n.href || path.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-[0.95rem] font-semibold ${active ? "bg-ink text-paper" : "text-graphite hover:text-ink"}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
