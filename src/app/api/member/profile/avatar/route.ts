import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { validateUpload } from "@/lib/file-validation";
import { safeUploadName, uploadsDir } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AVATAR_MAX = 5 * 1024 * 1024;
const PREFIX = "/api/uploads/";

async function removeStored(url: string | null) {
  if (!url?.startsWith(PREFIX)) return;
  const name = safeUploadName(url.slice(PREFIX.length));
  if (name.startsWith("avatar-")) await unlink(path.join(uploadsDir(), name)).catch(() => undefined);
}

/** multipart/form-data with a JPG, PNG or WEBP `file`. */
export async function POST(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Send the photo as a file upload." }, { status: 400 });
  const result = await validateUpload(form.get("file"), ["jpeg", "png", "webp"], AVATAR_MAX);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const member = await prisma.member.findUnique({ where: { id: auth.value }, select: { avatarUrl: true } });
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });
  const name = `avatar-${randomUUID()}.${result.file.ext}`;
  await writeFile(path.join(dir, name), result.file.buffer);
  const avatarUrl = `${PREFIX}${name}`;

  await prisma.member.update({ where: { id: auth.value }, data: { avatarUrl } });
  await removeStored(member.avatarUrl);
  return NextResponse.json({ avatarUrl });
}

export async function DELETE(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const member = await prisma.member.findUnique({ where: { id: auth.value }, select: { avatarUrl: true } });
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.member.update({ where: { id: auth.value }, data: { avatarUrl: null } });
  await removeStored(member.avatarUrl);
  return NextResponse.json({ avatarUrl: null });
}
