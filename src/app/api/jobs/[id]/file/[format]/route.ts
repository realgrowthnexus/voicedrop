import { NextResponse, type NextRequest } from "next/server";
import { handle } from "@/lib/http";
import { fileUrl, getOwnJob } from "@/lib/jobs/service";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: NextRequest, ctx: RouteContext<"/api/jobs/[id]/file/[format]">) => {
  const u = await requireUser(req.headers);
  const { id, format } = await ctx.params;
  const job = await getOwnJob(u.id, id);
  const url = await fileUrl(job, format, req.nextUrl.searchParams.get("inline") !== "1");
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "no-store" } });
});
