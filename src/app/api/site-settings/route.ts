import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  mergeSettingSources,
  readFileSettings,
} from "@/lib/settings-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const file = await readFileSettings();
  try {
    const rows = await prisma.siteSetting.findMany();
    return NextResponse.json(mergeSettingSources(rows, file));
  } catch {
    return NextResponse.json(mergeSettingSources([], file));
  }
}
