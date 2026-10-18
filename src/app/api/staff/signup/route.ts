import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { verifySameOrigin } from "@/lib/csrf";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { validateUpload } from "@/lib/file-validation";
import { KYC_MAX_BYTES } from "@/lib/kyc";
import { deletePrivateFile, savePrivateFile } from "@/lib/private-storage";
import { generateStaffCode } from "@/lib/staff";
import { parseStaffApplication } from "@/lib/staff-application";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public staff application: creates a PENDING account with two identity documents for admin approval. */
export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  const limit = rateLimit(`staff-signup:${clientIp(req)}`, 5, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many applications from this network. Try again in ${Math.ceil(limit.retryAfter / 60)} min.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }
  if (Number(req.headers.get("content-length") || 0) > 2 * KYC_MAX_BYTES + 256 * 1024) {
    return NextResponse.json({ error: "Files are too large. Each document can be up to 5 MB." }, { status: 413 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Send your application as a form upload." }, { status: 400 });

  const fields: Record<string, unknown> = {};
  for (const key of ["fullName", "email", "phone", "dateOfBirth", "address", "region", "password", "primaryType", "secondaryType"]) {
    fields[key] = form.get(key);
  }
  const parsed = parseStaffApplication(fields);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const app = parsed.value;

  const [primary, secondary] = await Promise.all([
    validateUpload(form.get("primaryFile"), ["pdf", "jpeg", "png"], KYC_MAX_BYTES),
    validateUpload(form.get("secondaryFile"), ["pdf", "jpeg", "png"], KYC_MAX_BYTES),
  ]);
  if (!primary.ok) return NextResponse.json({ error: `Photo ID: ${primary.error}` }, { status: 400 });
  if (!secondary.ok) return NextResponse.json({ error: `Second document: ${secondary.error}` }, { status: 400 });

  if (await prisma.staff.findUnique({ where: { email: app.email }, select: { id: true } })) {
    return NextResponse.json(
      { error: "An application or staff account already uses this email. Sign in or contact an administrator." },
      { status: 409 },
    );
  }

  const staff = await prisma.staff.create({
    data: {
      staffCode: await generateStaffCode(),
      fullName: app.fullName,
      email: app.email,
      phone: app.phone,
      dateOfBirth: app.dateOfBirth,
      address: app.address,
      region: app.region,
      passwordHash: hashPassword(app.password),
      role: "STAFF",
      status: "PENDING",
      notes: "Self-registered application.",
    },
  });

  const saved: string[] = [];
  try {
    for (const [type, upload] of [
      [app.primaryType, primary.file],
      [app.secondaryType, secondary.file],
    ] as const) {
      const filePath = await savePrivateFile("staff", staff.id, upload.ext, upload.buffer);
      saved.push(filePath);
      await prisma.staffDocument.create({
        data: {
          staffId: staff.id,
          documentType: type,
          filePath,
          originalName: upload.originalName,
          mimeType: upload.mime,
          sizeBytes: upload.size,
          uploadedBy: "applicant",
        },
      });
    }
  } catch (error) {
    await prisma.staff.delete({ where: { id: staff.id } }).catch(() => undefined);
    await Promise.all(saved.map((p) => deletePrivateFile(p)));
    throw error;
  }

  await logActivity("STAFF", `Staff application received · ${staff.staffCode} · ${staff.fullName}`);
  return NextResponse.json({ ok: true, staffCode: staff.staffCode });
}
