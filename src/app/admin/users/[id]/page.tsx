import { notFound } from "next/navigation";
import { accountSummary } from "@/lib/account/summary";
import { banAction, compPlanAction, creditsAction, unbanAction } from "@/lib/admin/actions";
import { userDetail } from "@/lib/admin/ops";
import { requireAdminPage } from "@/lib/session";

const n = (x: number) => x.toLocaleString("en-US");
const t = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "–");
const btn = "btn btn-sm";
const input = "field h-10 text-sm";

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const d = await userDetail(id);
  if (!d) notFound();
  const s = await accountSummary(d.user);
  const u = d.user;
  return (
    <div>
      <h1 className="break-all title text-[clamp(1.6rem,3vw,2.2rem)]">{u.email}</h1>
      <p className="mt-1 text-sm text-mute">
        ID {u.id} · joined {t(u.createdAt)} UTC · {u.paddleCustomerId ? `Paddle ${u.paddleCustomerId}` : "no Paddle customer"}
      </p>
      {u.banned ? <p className="mt-3 font-semibold text-danger">Banned: {u.banReason}</p> : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-[20px] border border-line bg-surface p-5">
          <h2 className="font-bold">Balance</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li>Tier: <b>{s.tier}</b>{s.plan ? ` (${s.plan.source}, until ${s.plan.periodEnd.slice(0, 10)})` : ""}</li>
            <li>Free this week: {n(s.balances.freeRemaining)}</li>
            <li>Subscription left: {n(s.balances.subscriptionRemaining)} / {n(s.balances.subscriptionAllowance)}</li>
            <li>Pack / granted credits: {n(s.balances.packRemaining)}</li>
            <li>Used last 24 h: {n(s.balances.usedLast24h)}</li>
          </ul>
        </div>
        <div className="space-y-4 rounded-[20px] border border-line bg-surface p-5">
          <h2 className="font-bold">Actions</h2>
          <form action={creditsAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="userId" value={u.id} />
            <label className="text-sm">Credits (+/−)<input name="delta" type="number" required className={`${input} mt-1 block w-28`} /></label>
            <label className="text-sm">Note<input name="note" className={`${input} mt-1 block w-40`} /></label>
            <button className={`${btn} btn-primary`}>Apply</button>
          </form>
          <form action={compPlanAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="userId" value={u.id} />
            <label className="text-sm">Complimentary plan
              <select name="plan" defaultValue={u.compPlan ?? "none"} className={`${input} mt-1 block`}>
                <option value="none">None</option><option value="creator">Creator</option><option value="pro">Pro</option>
              </select>
            </label>
            <label className="text-sm">Days<input name="days" type="number" defaultValue={30} min={1} max={366} className={`${input} mt-1 block w-20`} /></label>
            <button className={`${btn} btn-secondary`}>Set plan</button>
          </form>
          {u.banned ? (
            <form action={unbanAction}><input type="hidden" name="userId" value={u.id} /><button className={`${btn} btn-secondary`}>Unban</button></form>
          ) : (
            <form action={banAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="userId" value={u.id} />
              <label className="text-sm">Ban reason<input name="reason" required className={`${input} mt-1 block w-56`} /></label>
              <button className={`${btn} btn-danger`}>Ban user</button>
            </form>
          )}
        </div>
      </section>

      <Table title="Recent voice-overs" head={["When", "Status", "Chars", "Voice", "Note"]} rows={d.recentJobs.map((j) => [t(j.createdAt), j.status, n(j.chars), j.voice, j.flagReason ?? j.error ?? ""])} />
      <Table title="Credit ledger" head={["When", "Bucket", "Change", "Reason", "Note"]} rows={d.ledger.map((l) => [t(l.createdAt), l.bucket, n(l.delta), l.reason, l.note ?? l.paddleRef ?? ""])} />
      <Table title="Payments" head={["When", "Kind", "Amount", "Status", "Paddle ID"]} rows={d.txns.map((x) => [t(x.createdAt), x.kind, `${(x.amountCents / 100).toFixed(2)} ${x.currency}`, x.status, x.paddleTransactionId])} />
      <Table title="Subscriptions" head={["Plan", "Status", "Period end", "Cancels", "Paddle ID"]} rows={d.subs.map((x) => [x.plan, x.status, t(x.periodEnd), x.cancelAtPeriodEnd ? "yes" : "no", x.paddleSubscriptionId])} />
      <Table title="Admin log" head={["When", "Action", "Details"]} rows={d.actions.map((a) => [t(a.createdAt), a.action, JSON.stringify(a.details)])} />
    </div>
  );
}

function Table({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-mute">Nothing yet.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-line text-mute"><tr>{head.map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="max-w-[24rem] truncate px-4 py-2">{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
