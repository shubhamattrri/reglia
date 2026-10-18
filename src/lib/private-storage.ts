import { randomUUID } from "crypto";
import { createReadStream } from "fs";
import { mkdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { Readable } from "stream";

/** Outside `public/` and outside `data/uploads`, so nothing here has a raw URL. */
export function privateRoot() {
  return path.join(process.cwd(), "data", "private");
}

type Scope = "members" | "staff" | "requests";

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

export async function savePrivateFile(scope: Scope, ownerId: string, ext: string, data: Buffer) {
  const owner = safeSegment(ownerId);
  if (!owner) throw new Error("Invalid owner.");
  const rel = path.posix.join("kyc", scope, owner, `${randomUUID()}.${safeSegment(ext)}`);
  const abs = resolvePrivatePath(rel);
  if (!abs) throw new Error("Invalid storage path.");
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, data, { mode: 0o600 });
  return rel;
}

export function resolvePrivatePath(rel: string) {
  const root = privateRoot();
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root + path.sep)) return null;
  return abs;
}

export async function deletePrivateFile(rel: string) {
  const abs = resolvePrivatePath(rel);
  if (abs) await unlink(abs).catch(() => undefined);
}

/** Streams a private file with headers that keep it out of shared caches and stop MIME sniffing. */
export async function privateFileResponse(
  rel: string,
  mime: string,
  downloadName: string,
  disposition: "inline" | "attachment" = "inline",
) {
  const abs = resolvePrivatePath(rel);
  const info = abs ? await stat(abs).catch(() => null) : null;
  if (!abs || !info?.isFile()) {
    return new Response(JSON.stringify({ error: "File not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream;
  const safeName = downloadName.replace(/["\\\r\n]/g, "_");
  return new Response(stream, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(info.size),
      "Content-Disposition": `${disposition}; filename="${safeName}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
