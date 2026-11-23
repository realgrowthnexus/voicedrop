import Link from "next/link";
import { listJobsAdmin } from "@/lib/admin/ops";
import { requireAdminPage } from "@/lib/session";

const STATUSES = ["", "held", "queued", "processing", "done", "failed", "rejected"];

export default async function AdminJobs({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdminPage();
  const { status = "" } = await searchParams;
  const rows = await listJobsAdmin(STATUSES.includes(status) && status ? status : null);
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Jobs</h1>
      <nav aria-label="Filter by status" className="mt-4 flex flex-wrap gap-2 text-sm">
        {STATUSES.map((s) => (
          <Link key={s || "all"} href={s ? `/admin/jobs?status=${s}` : "/admin/jobs"} aria-current={s === status ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 font-semibold ${s === status ? "bg-ink text-paper" : "border border-rule"}`}>
            {s || "all"}
          </Link>
        ))}
      </nav>
      <div className="mt-6 overflow-x-auto rounded-[20px] border border-rule bg-surface">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-rule text-graphite">
            <tr>{["Created (UTC)", "User", "Status", "Tier", "Chars", "Audio", "Error / flag"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {rows.map(({ job: j, email }) => (
              <tr key={j.id}>
                <td className="px-4 py-2 text-graphite">{j.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td className="px-4 py-2"><Link className="underline-offset-4 hover:underline" href={`/admin/users/${j.userId}`}>{email}</Link></td>
                <td className="px-4 py-2 font-semibold">{j.status}</td>
                <td className="px-4 py-2">{j.tier}</td>
                <td className="px-4 py-2">{j.chars.toLocaleString("en-US")}</td>
                <td className="px-4 py-2">{j.durationSec ? `${j.durationSec.toFixed(1)}s` : "–"}</td>
                <td className="max-w-[18rem] truncate px-4 py-2 text-graphite">{j.error ?? j.flagReason ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="p-6 text-graphite">No jobs.</p> : null}
      </div>
    </div>
  );
}
