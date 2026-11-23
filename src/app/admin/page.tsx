import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { clientIp } from "@/lib/abuse/ip";
import { env } from "@/lib/env";
import { getStats } from "@/lib/admin/ops";
import { budgetState } from "@/lib/jobs/budget";
import { requireAdminPage } from "@/lib/session";

export const metadata: Metadata = { title: "Admin" };

const n = (x: number) => x.toLocaleString("en-US");
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

export default async function AdminHome() {
  await requireAdminPage();
  const s = await getStats();
  const seenIp = clientIp(await headers());
  const budget = await budgetState();
  const budgetNote = budget.active
    ? `of $${budget.budgetUsd.toFixed(2)} budget; new jobs stop at $${budget.stopAtUsd.toFixed(2)}`
    : "budget guard off (not using RunPod)";
  const rows: [string, string, string?][] = [
    ["Users", n(s.users), `${n(s.usersLast7d)} new in 7 days`],
    ["Paying users", n(s.payingUsers), "active subscriptions"],
    ["Revenue, 30 days", `$${(s.revenue30dCents / 100).toFixed(2)}`, `${n(s.purchases30d)} payments, before Paddle fees`],
    ["Voice-overs, 24 h", n(s.jobs24h.total), `${n(s.jobs24h.done)} done, ${n(s.jobs24h.failed)} failed`],
    ["Characters, 24 h", n(s.chars24h), `${n(s.chars30d)} in 30 days`],
    ["Queue now", n(s.queue.queued + s.queue.processing), `${n(s.queue.processing)} generating, ${n(s.queue.queued)} waiting`],
    ["GPU spend (estimate)", `$${budget.spentUsd.toFixed(2)}`, budgetNote],
  ];
  const f = s.funnel30d;
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Overview</h1>
      {s.queue.held > 0 ? (
        <p className="mt-4 rounded-xl border border-ink bg-surface px-4 py-3">
          <span className="marker px-1 font-semibold">{s.queue.held} flagged script{s.queue.held > 1 ? "s" : ""}</span> waiting for review.{" "}
          <Link href="/admin/flags" className="font-semibold underline underline-offset-4">Review now</Link>
        </p>
      ) : null}
      <dl className="mt-6 grid gap-px overflow-hidden rounded-[20px] border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([k, v, sub]) => (
          <div key={k} className="bg-surface p-5">
            <dt className="text-sm text-graphite">{k}</dt>
            <dd className="mt-1 text-3xl font-extrabold tracking-tight">{v}</dd>
            {sub ? <dd className="text-sm text-graphite">{sub}</dd> : null}
          </div>
        ))}
      </dl>
      <h2 className="mt-10 text-xl font-bold">Funnel, last 30 days</h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-4">
        {[
          ["Signed up", f.signedUp, ""],
          ["Made audio", f.madeAudio, pct(f.madeAudio, f.signedUp)],
          ["Opened checkout", f.openedCheckout, pct(f.openedCheckout, f.signedUp)],
          ["Paid", f.paid, pct(f.paid, f.signedUp)],
        ].map(([label, v, p], i) => (
          <li key={label as string} className="rounded-2xl border border-rule bg-surface p-4">
            <p className="text-sm text-graphite">
              Step {i + 1}: {label}
            </p>
            <p className="text-2xl font-extrabold">{n(v as number)}</p>
            {p ? <p className="text-sm text-graphite">{p} of sign-ups</p> : null}
          </li>
        ))}
      </ol>
      <p className="mt-6 text-sm text-graphite">
        Setup check: the server sees your IP as <b className="text-ink">{seenIp}</b> via the <code>{env().IP_HEADER}</code> header.
        {seenIp === "unknown" ? " Per-IP sign-up limits are OFF until this shows your real public IP — see docs/DEPLOY.md." : " Per-IP limits are working."}
      </p>
      <p className="mt-2 text-sm text-graphite">Website visitors and traffic sources are in Umami. Stale jobs are cleaned up each time this page loads.</p>
    </div>
  );
}
