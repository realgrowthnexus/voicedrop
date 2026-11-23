import Link from "next/link";
import { moderateAction } from "@/lib/admin/actions";
import { listJobsAdmin } from "@/lib/admin/ops";
import { requireAdminPage } from "@/lib/session";

export default async function AdminFlags() {
  await requireAdminPage();
  const rows = await listJobsAdmin("held");
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Flagged scripts</h1>
      <p className="mt-2 max-w-2xl text-graphite">
        These scripts matched a safety rule. Approve to generate them, or reject to refuse and refund. Ban the user from their page if it&apos;s clear abuse.
      </p>
      {rows.length === 0 ? (
        <p className="mt-8 rounded-[20px] border border-dashed border-graphite/60 p-8 text-center text-graphite">Nothing to review.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {rows.map(({ job: j, email }) => (
            <li key={j.id} className="rounded-[20px] border border-rule bg-surface p-5">
              <p className="text-sm text-graphite">
                <Link href={`/admin/users/${j.userId}`} className="font-semibold text-ink underline-offset-4 hover:underline">{email}</Link> · {j.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC ·{" "}
                <span className="marker px-1">{j.flagReason}</span>
              </p>
              <p className="script-text mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-xl bg-paper p-4 text-sm">{j.text}</p>
              <form action={moderateAction} className="mt-4 flex gap-2">
                <input type="hidden" name="jobId" value={j.id} />
                <button name="decision" value="approve" className="h-10 rounded-full bg-ink px-5 text-sm font-semibold text-paper">Approve</button>
                <button name="decision" value="reject" className="h-10 rounded-full border border-danger px-5 text-sm font-semibold text-danger">Reject and refund</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
