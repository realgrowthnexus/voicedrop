"use client";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Me } from "@/lib/client-types";

const n = (x: number) => x.toLocaleString("en-US");
type Product = "creator" | "pro" | "pack";
const PLAN_NAME = { free: "Free", pack: "Credit pack", creator: "Creator", pro: "Pro" } as const;

function Meter({ label, used, total, note }: { label: string; used: number; total: number; note?: string }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between gap-3 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="script-text tabular-nums text-mute">
          {n(Math.max(0, total - used))} / {n(total)} left
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.max(0, total - used)}>
        <div className="h-2 rounded-full bg-lamp" style={{ width: `${100 - pct}%` }} />
      </div>
      {note ? <p className="mt-1 text-sm text-mute">{note}</p> : null}
    </div>
  );
}

export function BillingPanel({ initial, hasCustomer, paddle: paddleCfg }: { initial: Me; hasCustomer: boolean; paddle: { token: string; environment: "sandbox" | "production" } | null }) {
  const [me, setMe] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [packs, setPacks] = useState(1);
  const paddle = useRef<Paddle | undefined>(undefined);
  const params = useSearchParams();
  const router = useRouter();
  const autoOpened = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setMe(await api<Me>("/api/me"));
    } catch {}
  }, []);

  const ensurePaddle = useCallback(async () => {
    if (!paddleCfg) throw new Error("Payments aren't switched on yet. Please check back soon.");
    if (!paddle.current) {
      paddle.current = await initializePaddle({
        token: paddleCfg.token,
        environment: paddleCfg.environment,
        eventCallback: (e) => {
          if (e.name === "checkout.completed") {
            setMsg({ kind: "ok", text: "Payment received. Your characters will appear in a few seconds." });
            let tries = 0;
            const t = setInterval(() => {
              tries++;
              void refresh();
              if (tries > 10) clearInterval(t);
            }, 3000);
          }
        },
      });
    }
    if (!paddle.current) throw new Error("Checkout couldn't load. Please disable ad blockers for this site and try again.");
    return paddle.current;
  }, [paddleCfg, refresh]);

  const buy = useCallback(
    async (product: Product, quantity = 1) => {
      setMsg(null);
      setBusy(product);
      try {
        const p = await ensurePaddle();
        const { transactionId, email } = await api<{ transactionId: string; email: string | null }>("/api/billing/checkout", {
          method: "POST",
          body: JSON.stringify({ product, quantity }),
        });
        p.Checkout.open({ transactionId, ...(email ? { customer: { email } } : {}), settings: { displayMode: "overlay", theme: "light", allowLogout: false } });
      } catch (e) {
        setMsg({ kind: "error", text: (e as Error).message });
      } finally {
        setBusy(null);
      }
    },
    [ensurePaddle],
  );

  useEffect(() => {
    const want = params.get("buy");
    if (!autoOpened.current && (want === "creator" || want === "pro" || want === "pack")) {
      autoOpened.current = true;
      router.replace("/billing");
      void buy(want);
    }
  }, [params, buy, router]);

  async function portal() {
    setBusy("portal");
    setMsg(null);
    try {
      const { url } = await api<{ url: string }>("/api/billing/portal", { method: "POST" });
      window.location.href = url;
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
      setBusy(null);
    }
  }

  async function changePlan(plan: "creator" | "pro") {
    setBusy(plan);
    setMsg(null);
    try {
      await api("/api/billing/change-plan", { method: "POST", body: JSON.stringify({ plan }) });
      setMsg({ kind: "ok", text: `Switching to ${PLAN_NAME[plan]}. The change shows here within a minute.` });
      setTimeout(() => void refresh(), 4000);
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const b = me.balances;
  const paidPlan = me.plan?.source === "paddle" ? me.plan.plan : null;

  return (
    <div className="max-w-4xl">
      <h1 className="title text-[clamp(2.4rem,5vw,3.4rem)]">Plan &amp; billing</h1>
      {msg ? (
        <p role={msg.kind === "error" ? "alert" : "status"} className={`mt-6 rounded-xl border px-4 py-3 ${msg.kind === "error" ? "border-danger/40 bg-danger/10" : "border-ok/40 bg-ok/10"}`}>
          {msg.text}
        </p>
      ) : null}

      <section className="mt-8 rounded-[20px] border border-line bg-surface p-6" aria-labelledby="current">
        <h2 id="current" className="text-xl font-bold">
          You&apos;re on <span className="rounded-md bg-lamp px-1.5 text-lamp-ink">{PLAN_NAME[me.tier]}</span>
        </h2>
        {me.plan ? (
          <p className="mt-1 text-mute">
            {me.plan.source === "comp" ? "Complimentary plan" : "Renews or ends"} on{" "}
            {new Date(me.plan.periodEnd).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" })}.
          </p>
        ) : null}
        <div className="mt-6 space-y-5">
          {me.plan ? <Meter label="Monthly characters" used={b.subscriptionAllowance - b.subscriptionRemaining} total={b.subscriptionAllowance} /> : null}
          {me.tier === "free" || me.tier === "pack" ? (
            <Meter label="Free weekly characters" used={b.freeWeekly - b.freeRemaining} total={b.freeWeekly} note="Rolling 7-day window." />
          ) : null}
          {b.packRemaining > 0 ? (
            <p className="flex justify-between text-sm">
              <span className="font-semibold">Credit pack characters (never expire)</span>
              <span className="script-text tabular-nums text-mute">{n(b.packRemaining)}</span>
            </p>
          ) : null}
          {b.dailyCap ? <Meter label="Today's fair-use limit" used={b.usedLast24h} total={b.dailyCap} note="Rolling 24 hours." /> : null}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {hasCustomer ? (
            <button type="button" onClick={portal} disabled={busy !== null} className="btn btn-secondary">
              {busy === "portal" ? "Opening…" : "Invoices, payment method & cancel"}
            </button>
          ) : null}
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Plans">
        {(["creator", "pro"] as const).map((p) => {
          const isCurrent = paidPlan === p;
          return (
            <div key={p} className={`rounded-[20px] border p-6 transition-colors duration-300 ${isCurrent ? "border-lamp/60 bg-surface-2" : "border-line bg-surface"}`}>
              <h3 className="text-lg font-bold">
                {PLAN_NAME[p]}, ${p === "creator" ? 9 : 19} a month
              </h3>
              <p className="mt-1 text-mute">{p === "creator" ? "100,000" : "300,000"} characters a month, WAV + SRT, priority queue.</p>
              {isCurrent ? (
                <p className="mt-4 font-semibold">Your current plan</p>
              ) : paidPlan ? (
                <button type="button" onClick={() => changePlan(p)} disabled={busy !== null} className="mt-5 btn btn-secondary">
                  {busy === p ? "Switching…" : `Switch to ${PLAN_NAME[p]}`}
                </button>
              ) : (
                <button type="button" onClick={() => buy(p)} disabled={busy !== null} className={`mt-5 btn ${p === "creator" ? "btn-primary" : "btn-secondary"}`}>
                  {busy === p ? "Opening checkout…" : `Choose ${PLAN_NAME[p]}`}
                </button>
              )}
            </div>
          );
        })}
      </section>

      <section className="mt-4 rounded-[20px] border border-dashed border-line-strong p-6" aria-labelledby="packs">
        <h3 id="packs" className="text-lg font-bold">
          Credit packs: $5 for 50,000 characters
        </h3>
        <p className="mt-1 text-mute">Never expire. Works on any plan and unlocks WAV and SRT.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-sm font-semibold">Packs</span>
            <select value={packs} onChange={(e) => setPacks(Number(e.target.value))} className="field h-11 w-auto">
              {[1, 2, 3, 4, 5, 10].map((q) => (
                <option key={q} value={q}>
                  {q} × 50,000 (${q * 5})
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => buy("pack", packs)} disabled={busy !== null} className="btn btn-secondary">
            {busy === "pack" ? "Opening checkout…" : "Buy credits"}
          </button>
        </div>
      </section>
      <p className="mt-6 text-sm text-mute">
        Payments are processed by Paddle.com, our merchant of record, who handles taxes and invoices. See our <Link href="/refunds" className="link-underline text-ink">refund policy</Link>.
      </p>
    </div>
  );
}
