"use client";
import { useActionState } from "react";
import { saveSettingsAction, testEmailAction, type SettingsResult } from "@/lib/admin/actions";

export type FieldView = {
  key: string;
  label: string;
  group: string;
  secret?: boolean;
  placeholder?: string;
  help?: string;
  source: "env" | "site" | null;
  value: string;
  display: string | null;
};

const GROUPS: { id: string; title: string; intro: string }[] = [
  { id: "voice", title: "Voice engine", intro: "Needed to generate audio. The RunPod endpoint is already deployed with a $25 spend guard; just add an API key." },
  { id: "email", title: "Email", intro: "Sends the sign-in links. Hostinger mailbox: host smtp.hostinger.com, port 465, user = the full mailbox address." },
  { id: "google", title: "Google sign-in (optional)", intro: "Adds a “Continue with Google” button. Redirect URI: https://voicedrop.rest/api/auth/callback/google" },
  { id: "captcha", title: "Bot protection (optional)", intro: "Cloudflare Turnstile on the sign-in form." },
  { id: "payments", title: "Payments (optional)", intro: "Paddle keys and price IDs. Webhook URL: https://voicedrop.rest/api/webhooks/paddle" },
];

function Status({ r }: { r: SettingsResult | null }) {
  if (!r) return null;
  return (
    <p role="status" className={`text-sm ${r.ok ? "text-ok" : "text-danger"}`}>
      {r.message}
    </p>
  );
}

export function SettingsForm({ fields, emailReady }: { fields: FieldView[]; emailReady: boolean }) {
  const [saved, save, saving] = useActionState(saveSettingsAction, null);
  const [tested, test, testing] = useActionState(testEmailAction, null);
  return (
    <>
      <form action={save} className="mt-10 space-y-10">
        {GROUPS.map((g) => (
          <fieldset key={g.id} className="panel p-5 sm:p-6">
            <legend className="sr-only">{g.title}</legend>
            <h2 className="text-lg font-semibold tracking-[-0.02em]" aria-hidden>
              {g.title}
            </h2>
            <p className="mt-1 max-w-[70ch] text-sm text-mute">{g.intro}</p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {fields
                .filter((f) => f.group === g.id)
                .map((f) => (
                  <div key={f.key}>
                    <label htmlFor={f.key} className="block text-sm font-medium">
                      {f.label}
                    </label>
                    <input
                      id={f.key}
                      name={f.key}
                      type={f.secret ? "password" : "text"}
                      autoComplete="off"
                      spellCheck={false}
                      defaultValue={f.value}
                      disabled={f.source === "env"}
                      placeholder={f.secret && f.display ? `Saved (${f.display}). Leave blank to keep.` : f.placeholder}
                      className="field mt-2 font-mono text-sm placeholder:font-sans placeholder:text-mute"
                      aria-describedby={`${f.key}-hint`}
                    />
                    <p id={`${f.key}-hint`} className="mt-1.5 text-xs text-mute">
                      {f.source === "env"
                        ? "Set in Hostinger environment variables (change it there)."
                        : f.help ?? (f.display ? "Saved." : "Not set.")}
                    </p>
                    {f.source === "site" && f.secret ? (
                      <label className="mt-1.5 inline-flex items-center gap-2 text-xs text-mute">
                        <input type="checkbox" name={`clear:${f.key}`} className="size-3.5 accent-[var(--lamp)]" />
                        Remove this value
                      </label>
                    ) : null}
                  </div>
                ))}
            </div>
          </fieldset>
        ))}
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-4 rounded-full border border-line bg-surface/90 px-3 py-2 backdrop-blur">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </button>
          <Status r={saved} />
        </div>
      </form>

      <form action={test} className="mt-8 flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-secondary" disabled={testing || !emailReady}>
          {testing ? "Sending…" : "Send me a test email"}
        </button>
        <Status r={tested} />
      </form>
    </>
  );
}
