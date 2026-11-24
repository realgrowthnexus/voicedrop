import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { LOCAL_KEY_RE, storageRoot, verifyLocalUrl } from "@/lib/storage/local";

export const dynamic = "force-dynamic";

function resolve(keyParts: string[]): { key: string; file: string } | null {
  const e = env();
  if (e.STORAGE_BACKEND !== "disk") return null;
  const key = keyParts.join("/");
  if (!LOCAL_KEY_RE.test(key)) return null;
  const root = storageRoot();
  const file = path.resolve(root, key);
  if (!file.startsWith(root + path.sep)) return null;
  return { key, file };
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/files/[...key]">) {
  const r = resolve((await ctx.params).key);
  if (!r || !verifyLocalUrl("put", r.key, req.nextUrl.searchParams)) return new NextResponse("forbidden", { status: 403 });
  if (req.headers.get("content-type") !== req.nextUrl.searchParams.get("ct")) return new NextResponse("bad content type", { status: 400 });
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length > 200 * 1024 * 1024) return new NextResponse("too large", { status: 413 });
  await mkdir(path.dirname(r.file), { recursive: true });
  await writeFile(r.file, body);
  return new NextResponse(null, { status: 200 });
}

/** Serves the file with HTTP Range support (Safari needs it to play audio). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/files/[...key]">) {
  const r = resolve((await ctx.params).key);
  const q = req.nextUrl.searchParams;
  if (!r || !verifyLocalUrl("get", r.key, q)) return new NextResponse("forbidden", { status: 403 });
  let data: Buffer;
  try {
    data = await readFile(r.file);
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
  const base = {
    "content-type": q.get("ct")!,
    "content-disposition": `${q.get("dl") === "1" ? "attachment" : "inline"}; filename="${q.get("fn")}"`,
    "cache-control": "private, max-age=900",
    "accept-ranges": "bytes",
  };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (m && (m[1] || m[2])) {
    const size = data.length;
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end || start >= size) {
      return new NextResponse(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    }
    const part = data.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(part), {
      status: 206,
      headers: { ...base, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(part.length) },
    });
  }
  return new NextResponse(new Uint8Array(data), { headers: { ...base, "content-length": String(data.length) } });
}
