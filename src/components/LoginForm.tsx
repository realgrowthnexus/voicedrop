"use client";
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

export function LoginForm({
  googleEnabled,
  emailEnabled = true,
  turnstileSiteKey,
}: {
  googleEnabled: boolean;
  emailEnabled?: boolean;
  turnstileSiteKey: string | null;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
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
          action: "magic-link",
          callback: (t) => setToken(t),
          "expired-callback": () => setToken(null),
        });
      }
    };
    if (window.turnstile) return render();
    const s = document.createElement("script");
    s.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [turnstileSiteKey]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (turnstileSiteKey && !token) {
      setError("Please complete the check above the button first.");
      return;
    }
    setState("sending");
    const { error: err } = await authClient.signIn.magicLink(
      {
        email: email.trim(),
        callbackURL: "/dashboard",
        errorCallbackURL: "/login",
      },
      token ? { headers: { "x-captcha-response": token } } : undefined,
    );
    if (err) {
      setState("idle");
      setError(
        err.status === 429
          ? "Too many attempts. Please wait a few minutes and try again."
          : (err.message ?? "We couldn't send the link. Please try again."),
      );
      if (widget.current) window.turnstile?.reset(widget.current);
      setToken(null);
      return;
    }
    setState("sent");
  }

  async function google() {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
      errorCallbackURL: "/login",
    });
  }

  if (state === "sent") {
    return (
      <div className="panel fade-in mt-8 p-6" role="status">
        <div
          className="mb-4 grid size-11 place-items-center rounded-full bg-lamp text-lamp-ink"
          aria-hidden
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold tracking-[-0.02em]">
          Check your inbox
        </h2>
        <p className="mt-2 text-mute">
          We sent a sign-in link to{" "}
          <span className="font-semibold text-ink">{email}</span>. It works once
          and expires in 15 minutes.
        </p>
        <button
          type="button"
          className="link-underline mt-4 font-semibold"
          onClick={() => setState("idle")}
        >
          Use a different email
        </button>
      </div>
    );
  }

  if (!googleEnabled && !emailEnabled) {
    return (
      <div className="panel mt-8 p-6" role="status">
        <h2 className="text-lg font-semibold tracking-[-0.02em]">
          Sign-in opens shortly
        </h2>
        <p className="mt-2 text-mute">
          We&apos;re finishing setup. Please check back in a little while.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      {googleEnabled ? (
        <>
          <button
            type="button"
            onClick={google}
            className="btn btn-secondary w-full"
          >
            <svg aria-hidden width="18" height="18" viewBox="0 0 48 48">
              <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
              />
            </svg>
            Continue with Google
          </button>
          {emailEnabled ? (
            <div className="my-6 flex items-center gap-3 text-sm text-mute">
              <span className="h-px flex-1 bg-line" />
              or use email
              <span className="h-px flex-1 bg-line" />
            </div>
          ) : null}
        </>
      ) : null}
      {emailEnabled ? (
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
          {turnstileSiteKey ? (
            <div ref={box} className="mt-4 min-h-[65px]" />
          ) : null}
          {error ? (
            <p id="login-error" role="alert" className="mt-3 text-danger">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={
              state === "sending" || !/^\S+@\S+\.\S+$/.test(email.trim())
            }
            className="btn btn-primary mt-5 w-full"
          >
            {state === "sending" ? "Sending link…" : "Email me a sign-in link"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
