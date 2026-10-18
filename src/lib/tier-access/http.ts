import { NextResponse } from "next/server";
import { getActiveStaff } from "@/lib/rbac";
import { getAdminActor } from "@/lib/session";
import { validateUpload, type ValidatedUpload } from "@/lib/file-validation";
import { KYC_MAX_BYTES } from "@/lib/kyc";
import { TierAccessError, type DeskActor } from "@/lib/tier-access/service";

/**
 * The desk acts as exactly the role it asks for, so a browser holding both an admin and a staff
 * session still gives a staff approval from the staff portal and an admin approval from the admin panel.
 */
export async function deskActor(as: unknown): Promise<DeskActor | null> {
  if (as === "admin") {
    const admin = await getAdminActor();
    return admin ? { role: "admin", id: admin.id, name: admin.name } : null;
  }
  if (as === "staff") {
    const staff = await getActiveStaff();
    return staff ? { role: "staff", id: staff.id, name: staff.fullName } : null;
  }
  return null;
}

export function errorResponse(error: unknown, fallback: string) {
  if (error instanceof TierAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

const ACCEPTED = ["pdf", "jpeg", "png"] as const;

type Parsed<T> = { ok: true; value: T } | { ok: false; response: NextResponse };

function bad(error: string, status = 400) {
  return { ok: false as const, response: NextResponse.json({ error }, { status }) };
}

async function optionalFile(entry: FormDataEntryValue | null, label: string): Promise<Parsed<ValidatedUpload | null>> {
  if (!(entry instanceof File) || entry.size < 1) return { ok: true, value: null };
  const result = await validateUpload(entry, [...ACCEPTED], KYC_MAX_BYTES);
  return result.ok ? { ok: true, value: result.file } : bad(`${label}: ${result.error}`);
}

/** Multipart form with up to two PDF/JPG/PNG files (5 MB each). */
export async function readRequestForm(req: Request, requireDocument: boolean): Promise<
  Parsed<{ form: FormData; document: ValidatedUpload | null; receipt: ValidatedUpload | null }>
> {
  const length = Number(req.headers.get("content-length") || 0);
  if (length > KYC_MAX_BYTES * 2 + 64 * 1024) return bad("Files are too large. Maximum is 5 MB each.", 413);
  const form = await req.formData().catch(() => null);
  if (!form) return bad("Send the request as a form upload.");

  let document: ValidatedUpload | null = null;
  if (requireDocument) {
    const result = await validateUpload(form.get("document"), [...ACCEPTED], KYC_MAX_BYTES);
    if (!result.ok) return bad(`Supporting document: ${result.error}`);
    document = result.file;
  }
  const receipt = await optionalFile(form.get("receipt"), "Payment receipt");
  if (!receipt.ok) return receipt;
  return { ok: true, value: { form, document, receipt: receipt.value } };
}

export function text(form: FormData, key: string, max: number) {
  const value = String(form.get(key) ?? "").trim().slice(0, max);
  return value || null;
}
