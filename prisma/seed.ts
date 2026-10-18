import { PrismaClient } from "@prisma/client";
import { generateHoldCode, generateSecureToken } from "../src/lib/identity";
import { hashPassword } from "../src/lib/password";
import { TIER_CODE_BY_SLUG } from "../src/lib/registry/format";
import { ensureRegistry, issueAndActivate } from "../src/lib/registry/service";

const prisma = new PrismaClient();

const DEMO_STAFF_PASSWORD = "Desk@2026";
const DEMO_MEMBER_PASSWORD = "Member@2026";

const tiers = [
  {
    slug: "signature",
    name: "Regalia Signature",
    subtitle: "Personal Concierge",
    summary:
      "Foundational private concierge — hotels, flights and ships held in one discreet channel.",
    accent: "#c9a45b",
    metalFrom: "#1a2a1c",
    metalTo: "#0A1A12",
    sortOrder: 0,
    price: 12000,
    frontImage: "/cards/signature-front.jpg",
    backImage: "/cards/signature-back.jpg",
    features: [
      { label: "Hotel Reservations", icon: "Hotel" },
      { label: "Flight Coordination", icon: "Plane" },
      { label: "Ship Booking", icon: "Ship" },
      { label: "Dedicated Concierge Desk", icon: "Headset" },
    ],
  },
  {
    slug: "prestige",
    name: "Regalia Prestige",
    subtitle: "Elevated Lifestyle Management",
    summary:
      "Elevated lifestyle custody — dining, global access and last-minute changes absorbed quietly.",
    accent: "#d4af37",
    metalFrom: "#243528",
    metalTo: "#0d1c14",
    sortOrder: 1,
    price: 28000,
    frontImage: "/cards/prestige-front-card.jpg",
    backImage: "/cards/prestige-back-card.jpg",
    features: [
      { label: "Global Access", icon: "Globe" },
      { label: "Private Dining", icon: "UtensilsCrossed" },
      { label: "Lifestyle Management", icon: "Crown" },
      { label: "Priority Review Lanes", icon: "Timer" },
    ],
  },
  {
    slug: "sovereign",
    name: "Sovereign",
    subtitle: "Bespoke Private Access",
    summary:
      "Bespoke access beyond public lists — security, venues and introductions arranged in advance.",
    accent: "#e8d5a3",
    metalFrom: "#2c2114",
    metalTo: "#120e08",
    sortOrder: 2,
    price: 65000,
    features: [
      { label: "Bespoke Access", icon: "KeyRound" },
      { label: "Security Planning", icon: "Shield" },
      { label: "Private Venues", icon: "Building2" },
      { label: "Senior Desk Escalation", icon: "BadgeCheck" },
    ],
  },
  {
    slug: "imperium",
    name: "Regalia Imperium",
    subtitle: "Ultra VVIP",
    summary:
      "The ultimate tier — white-glove custody, yacht charters and invitation-led privileges.",
    accent: "#f0d78c",
    metalFrom: "#0c0c0c",
    metalTo: "#1a1610",
    sortOrder: 3,
    price: 150000,
    features: [
      { label: "Yacht Charters", icon: "Anchor" },
      { label: "White-Glove Custody", icon: "Gem" },
      { label: "Invitation Privileges", icon: "Sparkles" },
      { label: "Immediate Escalation", icon: "Zap" },
    ],
  },
];

async function main() {
  await prisma.serviceHistory.deleteMany();
  await prisma.message.deleteMany();
  await prisma.preference.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.conciergeRequest.deleteMany();
  await prisma.physicalCard.deleteMany();
  await prisma.membershipCredential.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.member.deleteMany();
  await prisma.tierFeature.deleteMany();
  await prisma.tier.deleteMany();
  // Seeding wipes every credential, so the words are free again. The sequence counter is left
  // alone: registry numbers are never reused, even across a reseed.
  await prisma.registryWord.updateMany({
    data: { status: "AVAILABLE", memberUuid: null, credentialId: null, reservedAt: null, issuedAt: null, retiredAt: null },
  });

  const createdTiers = [];
  for (const t of tiers) {
    const row = await prisma.tier.create({
      data: {
        slug: t.slug,
        name: t.name,
        subtitle: t.subtitle,
        summary: t.summary,
        accent: t.accent,
        metalFrom: t.metalFrom,
        metalTo: t.metalTo,
        sortOrder: t.sortOrder,
        tierRank: t.sortOrder + 1,
        code: TIER_CODE_BY_SLUG[t.slug],
        price: t.price,
        frontImage: "frontImage" in t ? t.frontImage : null,
        backImage: "backImage" in t ? t.backImage : null,
        currency: "GBP",
        features: {
          create: t.features.map((f, i) => ({
            label: f.label,
            icon: f.icon,
            sortOrder: i,
          })),
        },
      },
    });
    createdTiers.push(row);
  }
  await ensureRegistry(prisma);

  const imperium = createdTiers.find((t) => t.slug === "imperium")!;
  const prestige = createdTiers.find((t) => t.slug === "prestige")!;

  const vale = await prisma.member.create({
    data: {
      fullName: "Alexander Vale",
      email: "vale@regalia.private",
      phone: "+44 7700 900184",
      passwordHash: hashPassword(DEMO_MEMBER_PASSWORD),
    },
  });

  const nora = await prisma.member.create({
    data: {
      fullName: "Nora Ellison",
      email: "nora@regalia.private",
      phone: "+1 212 555 0190",
      passwordHash: hashPassword(DEMO_MEMBER_PASSWORD),
    },
  });

  const valeMembership = await prisma.membership.create({
    data: {
      memberId: vale.id,
      tierId: imperium.id,
      membershipNo: "M-2026-001847",
      membershipCode: generateHoldCode(),
      status: "ACTIVE",
      issuedAt: new Date("2026-01-12"),
      validThru: new Date("2027-01-12"),
      renewedAt: new Date("2026-01-12"),
      accessLevel: "ULTRA VVIP",
    },
  });

  const noraMembership = await prisma.membership.create({
    data: {
      memberId: nora.id,
      tierId: prestige.id,
      membershipNo: "M-2026-001903",
      membershipCode: generateHoldCode(),
      status: "ACTIVE",
      issuedAt: new Date("2026-03-04"),
      validThru: new Date("2027-03-04"),
      accessLevel: "ELEVATED",
    },
  });

  await prisma.physicalCard.create({
    data: {
      membershipId: valeMembership.id,
      serialNumber: "LR-CSN-884721",
      qrToken: generateSecureToken(),
      nfcToken: generateSecureToken(),
      status: "ACTIVE",
    },
  });

  await prisma.physicalCard.create({
    data: {
      membershipId: noraMembership.id,
      serialNumber: "LR-CSN-190334",
      qrToken: generateSecureToken(),
      nfcToken: generateSecureToken(),
      status: "ACTIVE",
    },
  });

  const issued: string[] = [];
  for (const [member, membership] of [
    [vale, valeMembership],
    [nora, noraMembership],
  ] as const) {
    const credential = await issueAndActivate(prisma, { memberId: member.id, membershipId: membership.id });
    await prisma.membership.update({
      where: { id: membership.id },
      data: { membershipCode: credential.membershipCode },
    });
    issued.push(`${member.email}: ${credential.regaliaId} | ${credential.membershipCode}`);
  }

  const staff = await prisma.staff.upsert({
    where: { staffCode: "STF-1001" },
    update: { passwordHash: hashPassword(DEMO_STAFF_PASSWORD), status: "ACTIVE" },
    create: {
      staffCode: "STF-1001",
      fullName: "Isabella Moreau",
      email: "desk@regalia.private",
      phone: "+44 7700 900321",
      passwordHash: hashPassword(DEMO_STAFF_PASSWORD),
      region: "London",
      categories: JSON.stringify(["Travel & Journey", "Dining & Hospitality"]),
    },
  });

  await prisma.conciergeRequest.createMany({
    data: [
      {
        membershipId: valeMembership.id,
        title: "Geneva board week, private air",
        category: "Travel",
        details: "Two principals, one overnight, contingent routing if the 18:40 slips.",
        status: "IN_PROGRESS",
        quoteAmount: 18400,
        assignedStaffId: staff.id,
        assignedAt: new Date(),
      },
      {
        membershipId: valeMembership.id,
        title: "Table at The Ledbury, Saturday",
        category: "Dining",
        details: "Four covers, no public waitlist, arrival at 21:15.",
        status: "QUOTE",
        quoteAmount: 0,
      },
    ],
  });

  await prisma.booking.create({
    data: {
      membershipId: valeMembership.id,
      title: "Claridge's — Royal Suite",
      category: "Residence",
      vendor: "Claridge's",
      date: new Date("2026-10-08"),
      status: "CONFIRMED",
      amount: 6200,
    },
  });

  await prisma.preference.createMany({
    data: [
      { memberId: vale.id, key: "Airline", value: "Front-cabin only, aisle" },
      { memberId: vale.id, key: "Dining", value: "Quiet rooms, no photography" },
      { memberId: vale.id, key: "Ground", value: "Armoured saloon, no livery" },
    ],
  });

  await prisma.message.createMany({
    data: [
      {
        memberId: vale.id,
        fromRole: "CONCIERGE",
        body: "Good evening, Mr Vale. Geneva holds are confirmed. Two options for the 18:40 contingency are ready for your word.",
      },
      {
        memberId: vale.id,
        fromRole: "MEMBER",
        body: "Hold the first option. Keep the suite through Sunday.",
      },
    ],
  });

  await prisma.serviceHistory.create({
    data: {
      membershipId: valeMembership.id,
      title: "Milan family weekend — closed",
      notes: "Ground, residence and table executed without exposure.",
      completedAt: new Date("2026-08-22"),
    },
  });

  console.log("Seeded Limasu Regalia identity system.");
  for (const line of issued) console.log(line);
  console.log(`Member login: email, REGALIA ID or Membership Code + ${DEMO_MEMBER_PASSWORD}`);
  console.log("Admin login: admin123 / shubham");
  console.log(`Staff login: STF-1001 / ${DEMO_STAFF_PASSWORD}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
