import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { validateUpload } from "@/lib/file-validation";
import { localUploadName, serviceDto } from "@/lib/services";
import { safeUploadName, uploadsDir } from "@/lib/uploads";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

const IMAGE_MAX = 15 * 1024 * 1024;
const VIDEO_MAX = 80 * 1024 * 1024;

async function removeStored(mediaPath: string | null) {
  const name = safeUploadName(localUploadName(mediaPath) || "");
  if (name) await unlink(path.join(uploadsDir(), name)).catch(() => undefined);
}

/**
 * multipart/form-data: `file` + `target` ("media" | "poster").
 * Media accepts JPG/PNG/WEBP images or MP4/WEBM video; a poster (video cover) accepts images only.
 */
export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const { id } = await ctx.params;
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) return NextResponse.json({ error: "Service not found." }, { status: 404 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Send the media as a file upload." }, { status: 400 });
  const target = form.get("target") === "poster" ? "poster" : "media";
  const entry = form.get("file");
  const isVideoName = entry instanceof File && /\.(mp4|m4v|webm)$/i.test(entry.name);

  const result =
    target === "poster" || !isVideoName
      ? await validateUpload(entry, ["jpeg", "png", "webp"], IMAGE_MAX)
      : await validateUpload(entry, ["mp4", "webm"], VIDEO_MAX);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });
  const name = `service-${service.slug.slice(0, 40)}-${target}-${randomUUID().slice(0, 12)}.${result.file.ext}`;
  await writeFile(path.join(dir, name), result.file.buffer);
  const url = `/api/uploads/${name}`;
  const isVideo = result.file.kind === "mp4" || result.file.kind === "webm";

  const row = await prisma.service.update({
    where: { id },
    data:
      target === "poster"
        ? { posterPath: url }
        : { mediaPath: url, mediaType: isVideo ? "VIDEO" : "IMAGE" },
  });
  await removeStored(target === "poster" ? service.posterPath : service.mediaPath);
  await logActivity("SERVICE", `Service ${target} updated · ${service.title}`);
  return NextResponse.json({ service: serviceDto(row) });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const { id } = await ctx.params;
  const target = new URL(req.url).searchParams.get("target") === "poster" ? "poster" : "media";
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) return NextResponse.json({ error: "Service not found." }, { status: 404 });

  const row = await prisma.service.update({
    where: { id },
    data:
      target === "poster"
        ? { posterPath: null }
        : { mediaPath: null, mediaType: "NONE" },
  });
  await removeStored(target === "poster" ? service.posterPath : service.mediaPath);
  return NextResponse.json({ service: serviceDto(row) });
}
