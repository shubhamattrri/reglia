import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import { TIER_LABEL, WORD_POOLS, type PooledTierCode } from "@/lib/registry/format";
import { ensureRegistryOnce } from "@/lib/registry/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Word-pool availability per tier, for the approval word picker and registry overview. */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureRegistryOnce(prisma);
  const [words, counter, tiers] = await Promise.all([
    prisma.registryWord.findMany({ select: { tierCode: true, word: true, status: true } }),
    prisma.registryCounter.findUnique({ where: { name: "registry_sequence" } }),
    prisma.tier.findMany({ select: { id: true, name: true, code: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const pools = (Object.keys(WORD_POOLS) as PooledTierCode[]).map((tierCode) => {
    const order = WORD_POOLS[tierCode];
    const rows = words
      .filter((w) => w.tierCode === tierCode)
      .sort((a, b) => order.indexOf(a.word) - order.indexOf(b.word));
    const count = (status: string) => rows.filter((r) => r.status === status).length;
    return {
      tierCode,
      label: TIER_LABEL[tierCode],
      size: order.length,
      available: rows.filter((r) => r.status === "AVAILABLE").map((r) => r.word),
      counts: {
        AVAILABLE: count("AVAILABLE"),
        RESERVED: count("RESERVED"),
        ISSUED: count("ISSUED"),
        RETIRED: count("RETIRED"),
      },
    };
  });

  return NextResponse.json({
    lastSequence: counter?.value ?? 0,
    tiers,
    pools,
  });
}
