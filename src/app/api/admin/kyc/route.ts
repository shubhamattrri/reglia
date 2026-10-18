import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/rbac";
import { kycQueue, parseKycStatus } from "@/lib/kyc-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Members with KYC uploads, grouped, optionally filtered to those holding a document in `status`. */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  return NextResponse.json(await kycQueue(parseKycStatus(new URL(req.url).searchParams.get("status"))));
}
