import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { uploadsDir } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "svg", "gif"];
const VIDEO_EXT = ["mp4", "webm", "mov", "m4v"];

export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const slot = String(form.get("slot") || "file").replace(/[^a-zA-Z0-9_-]/g, "");

    if (!(file instanceof File) || file.size < 1) {
      return NextResponse.json({ error: "No file." }, { status: 400 });
    }

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const isVideo = VIDEO_EXT.includes(ext);
    const isImage = IMAGE_EXT.includes(ext);
    if (!isVideo && !isImage) {
      return NextResponse.json(
        { error: "Use jpg, png, webp, svg, gif, mp4 or webm." },
        { status: 400 }
      );
    }

    const max = isVideo ? 80 * 1024 * 1024 : 25 * 1024 * 1024;
    if (file.size > max) {
      return NextResponse.json(
        { error: isVideo ? "Video max 80MB." : "Image max 25MB." },
        { status: 400 }
      );
    }

    const dir = uploadsDir();
    await mkdir(dir, { recursive: true });
    const name = `${slot || "file"}-${Date.now()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, name), buf);

    return NextResponse.json({
      url: `/api/uploads/${name}`,
      kind: isVideo ? "video" : "image",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
