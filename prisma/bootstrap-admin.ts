import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.activityLog.count();
  if (count === 0) {
    await prisma.activityLog.createMany({
      data: [
        {
          type: "CARD_ISSUED",
          message: "Issued RG-00018472 · Alexander Vale · Regalia Imperium",
        },
        {
          type: "REQUEST",
          message: "New request · Geneva board week, private air",
        },
        {
          type: "SCAN",
          message: "RG-00018472 QR SUCCESS · LR-CSN-884721",
        },
      ],
    });
  }

  await prisma.conciergeRequest.updateMany({
    where: { title: { contains: "Geneva" } },
    data: { priority: "HIGH", paidAmount: 4200, invoiceRef: "INV-REG-1847" },
  });

  const cats = await prisma.serviceCategory.count();
  if (cats === 0) {
    await prisma.serviceCategory.createMany({
      data: [
        { slug: "travel", name: "Travel", icon: "Plane", sortOrder: 0 },
        { slug: "dining", name: "Dining", icon: "UtensilsCrossed", sortOrder: 1 },
        { slug: "stays", name: "Stays", icon: "Hotel", sortOrder: 2 },
        { slug: "wellness", name: "Wellness", icon: "Sparkles", sortOrder: 3 },
        { slug: "mobility", name: "Mobility", icon: "Ship", sortOrder: 4 },
        { slug: "private-events", name: "Private Events", icon: "Crown", sortOrder: 5 },
        { slug: "global-access", name: "Global Access", icon: "Globe", sortOrder: 6 },
        { slug: "discreet", name: "Discreet Services", icon: "Shield", sortOrder: 7 },
      ],
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
