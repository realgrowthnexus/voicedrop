import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { LOCAL_KEY_RE, verifyLocalUrl } from "@/lib/storage/local";

export const dynamic = "force-dynamic";

function resolve(keyParts: string[]): { key: string; file: string } | null {
  const e = env();
  if (e.STORAGE_BACKEND !== "local") return null;
  const key = keyParts.join("/");
  if (!LOCAL_KEY_RE.test(key)) return null;
  const root = path.resolve(e.LOCAL_STORAGE_DIR);
  const file = path.resolve(root, key);
  if (!file.startsWith(root + path.sep)) return null;
  return { key, file };
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/dev-storage/[...key]">) {
  const r = resolve((await ctx.params).key);
  if (!r || !verifyLocalUrl("put", r.key, req.nextUrl.searchParams)) return new NextResponse("forbidden", { status: 403 });
  if (req.headers.get("content-type") !== req.nextUrl.searchParams.get("ct")) return new NextResponse("bad content type", { status: 400 });
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length > 200 * 1024 * 1024) return new NextResponse("too large", { status: 413 });
  await mkdir(path.dirname(r.file), { recursive: true });
  await writeFile(r.file, body);
  return new NextResponse(null, { status: 200 });
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/dev-storage/[...key]">) {
  const r = resolve((await ctx.params).key);
  const q = req.nextUrl.searchParams;
  if (!r || !verifyLocalUrl("get", r.key, q)) return new NextResponse("forbidden", { status: 403 });
  try {
    const data = await readFile(r.file);
    const disp = `${q.get("dl") === "1" ? "attachment" : "inline"}; filename="${q.get("fn")}"`;
    return new NextResponse(data, { headers: { "content-type": q.get("ct")!, "content-disposition": disp, "content-length": String(data.length) } });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
