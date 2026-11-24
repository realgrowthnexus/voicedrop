import type { Metadata } from "next";
import { SettingsForm, type FieldView } from "@/components/admin/SettingsForm";
import { systemChecks, type Check } from "@/lib/admin/health";
import { SETTINGS, cfg } from "@/lib/config";
import { requireAdminPage } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

const DOT: Record<Check["state"], string> = {
  ok: "bg-ok",
  warn: "bg-lamp",
  off: "bg-line-strong",
  error: "bg-danger",
};
const WORD: Record<Check["state"], string> = { ok: "Working", warn: "Check", off: "Off", error: "Needs setup" };

function mask(v: string) {
  return v.length <= 8 ? "••••" : `••••${v.slice(-4)}`;
}

export default async function SettingsPage() {
  await requireAdminPage();
  const [checks, c] = await Promise.all([systemChecks(), cfg()]);
  const fields: FieldView[] = SETTINGS.map((d) => {
    const v = c.raw[d.key];
    return {
      ...d,
      source: c.source[d.key] ?? null,
      value: d.secret ? "" : (v ?? ""),
      display: v ? (d.secret ? mask(v) : v) : null,
    };
  });
  const blocking = checks.filter((x) => x.state === "error");
  return (
    <div>
      <h1 className="title text-[clamp(2rem,4vw,2.8rem)]">Settings</h1>
      <p className="mt-2 max-w-[60ch] text-mute">
        {blocking.length
          ? `${blocking.length} thing${blocking.length > 1 ? "s" : ""} to finish before VoiceDrop is fully ready.`
          : "Everything users need is working."}
      </p>

      <h2 className="mt-8 text-xl font-semibold tracking-[-0.02em]">System check</h2>
      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
        {checks.map((x) => (
          <li key={x.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-start sm:gap-6">
            <div className="flex min-w-[15rem] items-center gap-2.5 font-semibold">
              <span className={`size-2.5 shrink-0 rounded-full ${DOT[x.state]}`} aria-hidden />
              {x.name}
              <span className="sr-only">: {WORD[x.state]}</span>
            </div>
            <div className="text-sm">
              <p className="text-mute">{x.detail}</p>
              {x.fix && x.state !== "ok" ? <p className="mt-1 text-ink">{x.fix}</p> : null}
            </div>
          </li>
        ))}
      </ul>

      <SettingsForm fields={fields} emailReady={c.email.mode !== "none"} />
    </div>
  );
}
