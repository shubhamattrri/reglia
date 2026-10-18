import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/rbac";
import { kycQueue, parseKycStatus } from "@/lib/kyc-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Staff verification queue: members with uploaded identity documents and their declared details. */
export async function GET(req: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  return NextResponse.json(await kycQueue(parseKycStatus(new URL(req.url).searchParams.get("status"))));
}
