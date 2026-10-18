import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getMemberId, isAdmin } from "@/lib/session";
import { getActiveStaff } from "@/lib/rbac";
import { uploadsDir } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif"];
const FILE_EXT = ["pdf", "doc", "docx", "xls", "xlsx", "txt"];

export async function POST(req: Request) {
  const admin = await isAdmin();
  const memberId = await getMemberId();
  const staff = !admin && !memberId ? await getActiveStaff() : null;
  if (!admin && !memberId && !staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1) {
    return NextResponse.json({ error: "No file." }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const isImage = IMAGE_EXT.includes(ext);
  const isFile = FILE_EXT.includes(ext);
  if (!isImage && !isFile) {
    return NextResponse.json({ error: "Use an image, PDF or document." }, { status: 400 });
  }
  if (file.size > 12 * 1024 * 1024) {
    return NextResponse.json({ error: "File max 12MB." }, { status: 400 });
  }

  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });
  const who = admin ? "admin" : staff ? "staff" : "member";
  const name = `chat-${who}-${Date.now()}.${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({
    url: `/api/uploads/${name}`,
    fileName: file.name,
    kind: isImage ? "image" : "file",
  });
}
