import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/LoginForm";
import { env } from "@/lib/env";
import { getUser } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  disposable_email: "Please use a permanent email address. Temporary inboxes can't be used.",
  EXPIRED_TOKEN: "That sign-in link has expired. Request a new one below.",
  INVALID_TOKEN: "That sign-in link was already used or is invalid. Request a new one below.",
  account_suspended: "This account is suspended.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (await getUser()) redirect("/dashboard");
  const sp = await searchParams;
  const code = typeof sp.error === "string" ? sp.error : undefined;
  const e = env();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
        <Logo />
      </header>
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-24">
        <h1 className="text-4xl font-extrabold tracking-tight">Sign in or create an account</h1>
        <p className="mt-3 text-graphite">No password needed. New here? You start with 3,000 free characters a week.</p>
        {code ? (
          <p role="alert" className="mt-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-ink">
            {ERRORS[code] ?? "We couldn't sign you in. Please try again."}
          </p>
        ) : null}
        <LoginForm googleEnabled={!!(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET)} turnstileSiteKey={e.CAPTCHA_DISABLED ? null : (e.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null)} />
        <p className="mt-8 text-sm text-graphite">
          By continuing you agree to our <a className="underline underline-offset-4" href="/terms">Terms</a> and{" "}
          <a className="underline underline-offset-4" href="/acceptable-use">Acceptable Use Policy</a>.
        </p>
      </main>
    </div>
  );
}
