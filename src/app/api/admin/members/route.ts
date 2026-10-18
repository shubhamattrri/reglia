import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { generateApplicationNo, generateHoldCode } from "@/lib/identity";
import { approveMembership } from "@/lib/membership-pipeline";
import { identifierKey } from "@/lib/registry/format";
import { RegistryError } from "@/lib/registry/service";
import { parseAddress, parseDateOfBirth, parseFullName, parsePhone } from "@/lib/member-profile";

const memberInclude = {
  memberships: {
    include: {
      tier: true,
      cards: { orderBy: { issuedAt: "desc" as const } },
      requests: { orderBy: { createdAt: "desc" as const } },
    },
  },
  credentials: { orderBy: { createdAt: "desc" as const } },
};

/** `?q=` is an exact REGALIA ID / Membership Code search (any separators, exact letters and diacritics). */
export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (q) {
    const key = identifierKey(q);
    if (!key) return NextResponse.json([]);
    const members = await prisma.member.findMany({
      where: {
        OR: [{ regaliaKey: key }, { credentials: { some: { codeKey: key } } }],
      },
      include: memberInclude,
      omit: { passwordHash: true },
    });
    return NextResponse.json(members);
  }
  const members = await prisma.member.findMany({
    orderBy: { createdAt: "desc" },
    include: memberInclude,
    omit: { passwordHash: true },
  });
  return NextResponse.json(members);
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const tier = await prisma.tier.findUnique({
    where: { id: String(body.tierId || "") },
  });
  if (!tier) {
    return NextResponse.json({ error: "Tier required." }, { status: 400 });
  }
  if (!tier.code) {
    return NextResponse.json(
      { error: `${tier.name} has no registry tier code yet, so no REGALIA ID can be issued.` },
      { status: 400 },
    );
  }

  const fullName = parseFullName(body.fullName);
  if (!fullName.ok) return NextResponse.json({ error: fullName.error }, { status: 400 });
  const phone = body.phone ? parsePhone(body.phone) : null;
  if (phone && !phone.ok) return NextResponse.json({ error: phone.error }, { status: 400 });
  const dateOfBirth = body.dateOfBirth ? parseDateOfBirth(body.dateOfBirth) : null;
  if (dateOfBirth && !dateOfBirth.ok) return NextResponse.json({ error: dateOfBirth.error }, { status: 400 });
  const address = body.address ? parseAddress(body.address) : null;
  if (address && !address.ok) return NextResponse.json({ error: address.error }, { status: 400 });

  const validThru = body.validThru
    ? new Date(body.validThru)
    : new Date(Date.now() + 6 * 365 * 24 * 60 * 60 * 1000);

  const member = await prisma.member.create({
    data: {
      fullName: fullName.value,
      email: String(body.email || `member${Date.now()}@regalia.private`).trim().toLowerCase(),
      phone: phone?.ok ? phone.value : null,
      dateOfBirth: dateOfBirth?.ok ? dateOfBirth.value : null,
      address: address?.ok ? address.value : null,
      memberships: {
        create: {
          tierId: tier.id,
          membershipNo: generateApplicationNo(),
          membershipCode: generateHoldCode(),
          status: "PENDING",
          validThru,
          accessLevel: String(body.accessLevel || tier.subtitle),
        },
      },
    },
    include: { memberships: true },
  });

  try {
    await approveMembership(member.memberships[0].id, "admin", {
      word: typeof body.word === "string" && body.word.trim() ? body.word.trim() : null,
    });
  } catch (error) {
    await prisma.member.delete({ where: { id: member.id } });
    const message = error instanceof Error ? error.message : "Could not issue credentials.";
    return NextResponse.json({ error: message }, { status: error instanceof RegistryError ? 409 : 400 });
  }

  const issued = await prisma.member.findUniqueOrThrow({
    where: { id: member.id },
    include: memberInclude,
    omit: { passwordHash: true },
  });
  await logActivity(
    "CARD_ISSUED",
    `Issued ${issued.regaliaId} · ${issued.fullName} · ${tier.name}`
  );

  return NextResponse.json(issued);
}
