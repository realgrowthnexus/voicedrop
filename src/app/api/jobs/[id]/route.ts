import { NextResponse, type NextRequest } from "next/server";
import { handle } from "@/lib/http";
import { getOwnJob, reconcileJob, toPublicJob } from "@/lib/jobs/service";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: NextRequest, ctx: RouteContext<"/api/jobs/[id]">) => {
  const u = await requireUser(req.headers);
  const job = await reconcileJob(await getOwnJob(u.id, (await ctx.params).id));
  return NextResponse.json({ job: toPublicJob(job) }, { headers: { "cache-control": "no-store" } });
});
