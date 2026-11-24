"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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
  const [leaving, setLeaving] = useState(false);
  const items = isAdmin ? [...NAV, { href: "/admin", label: "Admin" }] : NAV;
  async function signOut() {
    setLeaving(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/75 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-between gap-x-4 px-5 sm:px-8">
        <div className="flex h-16 items-center">
          <Logo href="/dashboard" />
        </div>
        <nav aria-label="App" className="order-last -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {items.map((n) => {
            const active = path === n.href || path.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`relative whitespace-nowrap px-3.5 py-3 text-[0.95rem] font-medium transition-colors duration-300 sm:py-5 ${
                  active ? "text-ink" : "text-mute hover:text-ink"
                }`}
              >
                {n.label}
                <span
                  aria-hidden
                  className={`absolute inset-x-3.5 bottom-0 h-[2px] origin-left rounded-full bg-lamp transition-transform duration-500 ease-[var(--ease-out)] ${
                    active ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </Link>
            );
          })}
        </nav>
        <div className="flex h-16 items-center gap-1">
          <span className="hidden max-w-[14rem] truncate text-sm text-mute lg:inline">{email}</span>
          <ThemeToggle />
          <button type="button" onClick={signOut} disabled={leaving} className="btn btn-ghost btn-sm text-mute hover:text-ink">
            {leaving ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}
