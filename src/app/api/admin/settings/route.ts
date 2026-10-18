import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/site-settings";
import {
  mergeSettingSources,
  readFileSettings,
  writeFileSettings,
} from "@/lib/settings-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadSettings() {
  const file = await readFileSettings();
  try {
    const rows = await prisma.siteSetting.findMany();
    return mergeSettingSources(rows, file);
  } catch {
    return mergeSettingSources([], file);
  }
}

async function persistPrisma(key: string, value: string) {
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      await prisma.siteSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
      return;
    } catch (error) {
      last = error;
      await new Promise((r) => setTimeout(r, 120 * (i + 1)));
    }
  }
  throw last;
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await loadSettings());
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const allowed = new Set(Object.keys(DEFAULT_SITE_SETTINGS));
  const patch: Partial<SiteSettings> = {};

  for (const [key, value] of Object.entries(body)) {
    if (!allowed.has(key) || typeof value !== "string") continue;
    (patch as Record<string, string>)[key] = value;
  }

  if (Object.keys(patch).length) {
    try {
      await writeFileSettings(patch);
    } catch {
      return NextResponse.json(
        { error: "Could not save appearance. Check that the data folder is writable." },
        { status: 500 }
      );
    }
    for (const [key, value] of Object.entries(patch)) {
      try {
        await persistPrisma(key, value);
      } catch {
        /* file store already has the value */
      }
    }
  }

  return NextResponse.json(await loadSettings());
}
