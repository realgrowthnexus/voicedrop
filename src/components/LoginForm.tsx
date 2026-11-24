"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (t: string) => void;
          "expired-callback"?: () => void;
          theme?: string;
          action?: string;
        },
      ) => string;
      reset: (id?: string) => void;
    };
  }
}

type Mode = "signin" | "signup" | "link";

const ERR: Record<string, string> = {
  USER_ALREADY_EXISTS: "An account with this email already exists. Sign in instead.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "An account with this email already exists. Sign in instead.",
  INVALID_EMAIL_OR_PASSWORD: "That email and password don't match.",
  PASSWORD_TOO_SHORT: "Use at least 8 characters for your password.",
  PASSWORD_TOO_LONG: "That password is too long.",
  INVALID_EMAIL: "Please enter a valid email address.",
};

function GoogleIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function LoginForm({
  googleEnabled,
  emailEnabled = true,
  turnstileSiteKey,
}: {
  googleEnabled: boolean;
  /** Email delivery is set up: offer the "email me a link" option too. */
  emailEnabled?: boolean;
  turnstileSiteKey: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    if (!turnstileSiteKey) return;
    const render = () => {
      if (box.current && window.turnstile && !widget.current) {
        widget.current = window.turnstile.render(box.current, {
          sitekey: turnstileSiteKey,
          action: "login",
          callback: (t) => setToken(t),
          "expired-callback": () => setToken(null),
        });
      }
    };
    if (window.turnstile) return render();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [turnstileSiteKey]);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (turnstileSiteKey && !token) {
      setError("Please complete the check above the button first.");
      return;
    }
    setBusy(true);
    const opts = token ? { headers: { "x-captcha-response": token } } : undefined;
    const addr = email.trim();
    const res =
      mode === "link"
        ? await authClient.signIn.magicLink({ email: addr, callbackURL: "/dashboard", errorCallbackURL: "/login" }, opts)
        : mode === "signup"
          ? await authClient.signUp.email({ email: addr, password, name: addr.split("@")[0].slice(0, 60) }, opts)
          : await authClient.signIn.email({ email: addr, password }, opts);
    if (res.error) {
      setBusy(false);
      const err = res.error;
      setError(
        err.status === 429
          ? "Too many attempts. Please wait a few minutes and try again."
          : (ERR[err.code ?? ""] ?? err.message ?? "Something went wrong. Please try again."),
      );
      if (widget.current) window.turnstile?.reset(widget.current);
      setToken(null);
      return;
    }
    if (mode === "link") {
      setBusy(false);
      setSent(true);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  async function google() {
    await authClient.signIn.social({ provider: "google", callbackURL: "/dashboard", errorCallbackURL: "/login" });
  }

  if (sent) {
    return (
      <div className="panel fade-in mt-8 p-6" role="status">
        <div className="mb-4 grid size-11 place-items-center rounded-full bg-lamp text-lamp-ink" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
        </div>
        <h2 className="text-xl font-semibold tracking-[-0.02em]">Check your inbox</h2>
        <p className="mt-2 text-mute">
          We sent a sign-in link to <span className="font-semibold text-ink">{email}</span>. It works once and expires in 15 minutes.
        </p>
        <button type="button" className="link-underline mt-4 font-semibold" onClick={() => setSent(false)}>
          Use a different email
        </button>
      </div>
    );
  }

  const valid = /^\S+@\S+\.\S+$/.test(email.trim()) && (mode === "link" || password.length >= 8);
  const label = mode === "signup" ? "Create account" : mode === "link" ? "Email me a sign-in link" : "Sign in";

  return (
    <div className="mt-8">
      {googleEnabled ? (
        <>
          <button type="button" onClick={google} className="btn btn-secondary w-full">
            <GoogleIcon />
            Continue with Google
          </button>
          <div className="my-6 flex items-center gap-3 text-sm text-mute">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : null}

      {mode !== "link" ? (
        <div role="tablist" aria-label="Account" className="mb-6 grid grid-cols-2 rounded-full border border-line bg-surface p-1 text-sm font-semibold">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={`rounded-full px-4 py-2 transition-colors duration-300 ${mode === m ? "bg-ink text-bg" : "text-mute hover:text-ink"}`}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
      ) : null}

      <form onSubmit={submit} noValidate>
        <label htmlFor="email" className="block text-sm font-medium">
          Email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field mt-2 placeholder:text-mute"
          placeholder="you@example.com"
          aria-describedby={error ? "login-error" : undefined}
        />
        {mode !== "link" ? (
          <>
            <label htmlFor="password" className="mt-4 block text-sm font-medium">
              Password
            </label>
            <div className="relative mt-2">
              <input
                id="password"
                type={show ? "text" : "password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field pr-20"
                aria-describedby={mode === "signup" ? "pw-hint" : undefined}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute inset-y-0 right-2 my-auto h-9 rounded-full px-3 text-sm font-semibold text-mute hover:text-ink"
                aria-pressed={show}
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
            {mode === "signup" ? (
              <p id="pw-hint" className="mt-1.5 text-xs text-mute">
                At least 8 characters.
              </p>
            ) : null}
          </>
        ) : null}
        {turnstileSiteKey ? <div ref={box} className="mt-4 min-h-[65px]" /> : null}
        {error ? (
          <p id="login-error" role="alert" className="mt-3 text-danger">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy || !valid} className="btn btn-primary mt-5 w-full">
          {busy ? "Please wait…" : label}
        </button>
      </form>

      {emailEnabled ? (
        <p className="mt-5 text-center text-sm text-mute">
          {mode === "link" ? (
            <button type="button" className="link-underline font-semibold text-ink" onClick={() => switchMode("signin")}>
              Use a password instead
            </button>
          ) : (
            <button type="button" className="link-underline font-semibold text-ink" onClick={() => switchMode("link")}>
              Email me a sign-in link instead
            </button>
          )}
        </p>
      ) : null}
    </div>
  );
}
