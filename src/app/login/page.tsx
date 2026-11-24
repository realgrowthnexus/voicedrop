import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/LoginForm";
import { LoginStage } from "@/components/LoginStage";
import { cfg } from "@/lib/config";
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
  const c = await cfg();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <LoginStage />
      <div className="flex flex-col">
        <header className="px-5 py-5 sm:px-10 lg:hidden">
          <Logo />
        </header>
        <main id="main" className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center px-5 pb-20 pt-6">
          <h1 className="title text-[2.6rem]">
            <span className="line-mask"><span>Sign in or create</span></span>
            <span className="line-mask"><span style={{ ["--d" as string]: "90ms" }}>an account.</span></span>
          </h1>
          <p className="fade-in mt-4 text-mute" style={{ ["--d" as string]: "250ms" }}>
            New here? Create an account and get 3,000 free characters every week.
          </p>
          {code ? (
            <p role="alert" className="mt-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3">
              {ERRORS[code] ?? "We couldn't sign you in. Please try again."}
            </p>
          ) : null}
          <div className="fade-in" style={{ ["--d" as string]: "350ms" }}>
            <LoginForm googleEnabled={!!c.google} emailEnabled={c.email.mode !== "none"} turnstileSiteKey={c.captcha?.siteKey ?? null} />
          </div>
          <p className="mt-10 text-sm text-mute">
            By continuing you agree to our{" "}
            <a className="link-underline text-ink" href="/terms">Terms</a> and{" "}
            <a className="link-underline text-ink" href="/acceptable-use">Acceptable Use Policy</a>.
          </p>
        </main>
      </div>
    </div>
  );
}
