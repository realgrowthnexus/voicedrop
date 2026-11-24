import Link from "next/link";
import { searchUsers } from "@/lib/admin/ops";
import { requireAdminPage } from "@/lib/session";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminPage();
  const { q = "" } = await searchParams;
  const users = await searchUsers(q);
  return (
    <div>
      <h1 className="title text-[clamp(2rem,4vw,2.8rem)]">Users</h1>
      <form className="mt-4 flex max-w-lg gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search by email or user ID</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search by email or user ID" className="field flex-1" />
        <button className="btn btn-primary">Search</button>
      </form>
      <div className="mt-6 overflow-x-auto rounded-[20px] border border-line bg-surface">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-line text-mute">
            <tr>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Joined (UTC)</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${u.id}`} className="font-semibold underline-offset-4 hover:underline">{u.email}</Link>
                </td>
                <td className="px-4 py-3 text-mute">{u.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td className="px-4 py-3">{u.banned ? <span className="font-semibold text-danger">Banned</span> : u.compPlan ? `Comp ${u.compPlan}` : "Active"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 ? <p className="p-6 text-mute">No users match that search.</p> : null}
      </div>
    </div>
  );
}
